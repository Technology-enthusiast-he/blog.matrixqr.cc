const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const POSTS = path.join(ROOT, "posts");
const SITE = "https://blog.matrixqr.cc";
const OUT = path.join(ROOT, "llms.txt");
const FULL = path.join(ROOT, "llms-full.txt");
const EXCLUDED = new Set(["index.html", "privacy-policy.html"]);
const { normalizeCategory, CATEGORIES: CATEGORY_MAP, CATEGORY_NAMES } = require("./article-categories");
const { getLinksByRel } = require("./html-link-utils");
const CATEGORIES = CATEGORY_NAMES;

function decode(s = "") {
  const entities = {amp:"&",quot:'"',apos:"'",lt:"<",gt:">",nbsp:" ",ndash:"–",mdash:"—",rsquo:"’",lsquo:"‘",rdquo:"”",ldquo:"“",bull:"•",copy:"©",reg:"®"};
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m,e) => {
    if (e[0] === "#") { const hex=e[1].toLowerCase()==="x"; const n=parseInt(e.slice(hex?2:1),hex?16:10); return Number.isFinite(n)?String.fromCodePoint(n):m; }
    return entities[e.toLowerCase()] ?? m;
  });
}
function articleJson(html) {
  function find(v) {
    if (Array.isArray(v)) { for (const x of v) { const a=find(x); if(a)return a; } }
    else if(v && typeof v==="object") {
      const types=Array.isArray(v["@type"])?v["@type"]:[v["@type"]];
      if(types.some(t=>["BlogPosting","Article","NewsArticle"].includes(t)))return v;
      if(Array.isArray(v["@graph"]))return find(v["@graph"]);
    }
    return null;
  }
  for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{const a=find(JSON.parse(m[1]));if(a)return a;}catch{}}
  return null;
}
function attributes(tag) {
  const out = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)) out[m[1].toLowerCase()] = m[3];
  return out;
}
function meta(html,key) {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attributes(m[0]);
    if ((a.name || "").toLowerCase() === key.toLowerCase() && a.content !== undefined) return decode(a.content);
  }
  return "";
}
function category(s="") {
  const raw = normalizeCategory(s);
  if (!raw || !Object.prototype.hasOwnProperty.call(CATEGORY_MAP, raw)) {
    console.warn("[llms] Unmapped or missing articleSection " + JSON.stringify(s) + "; assigned to General.");
  }
  return CATEGORY_MAP[raw] || "General";
}
function scan(dir,rel="") {
  let out=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const r=path.posix.join(rel,e.name),full=path.join(dir,e.name),low=r.toLowerCase();
    if(e.isDirectory())out=out.concat(scan(full,r));
    else if(e.isFile()&&/\.html$/i.test(e.name)){
      if((!rel&&EXCLUDED.has(e.name.toLowerCase()))||low==="page/index.html"||/^page\/\d+\/index\.html$/.test(low))continue;
      out.push({full,rel:r});
    }
  }
  return out;
}
function markdown(source,url) {
  let h=source.replace(/<!--[\s\S]*?-->/g," ")
    .replace(/<(script|style|svg|button|form|nav|footer|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi," ")
    .replace(/<input\b[^>]*>/gi," ");
  h=h.replace(/<img\b([^>]*)>/gi,(_,a)=>{
    const s=a.match(/\bsrc=["']([^"']+)["']/i),alt=a.match(/\balt=["']([^"']*)["']/i);
    if(!s)return "";return "\n!["+decode(alt?alt[1]:"")+"]("+new URL(decode(s[1]),url).href.replace(/\(/g,"\\(").replace(/\)/g,"\\)")+")\n";
  });
  h=h.replace(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi,(_,a,inner)=>{
    const href=a.match(/\bhref=["']([^"']+)["']/i),label=inner.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
    if(!href||!label)return inner;try{return "["+label+"]("+new URL(decode(href[1]),url).href.replace(/\(/g,"\\(").replace(/\)/g,"\\)")+")";}catch{return label;}
  });
  const tick=String.fromCharCode(96);
  // Convert HTML tables before generic tag removal so cell boundaries are preserved.
  h=h.replace(/<table\b[^>]*>([\s\S]*?)<\/table\s*>/gi,(_,table)=>{
    const rows=[];
    for(const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)){
      const cells=[...row[1].matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)];
      if(!cells.length)continue;
      const values=cells.map(cell=>decode(cell[2].replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim()).replace(/\|/g,"\\|"));
      rows.push({values,header:cells.some(cell=>cell[1].toLowerCase()==="th")});
    }
    if(!rows.length)return "";
    const lines=[];
    rows.forEach((row,index)=>{
      lines.push("| "+row.values.join(" | ")+" |");
      if(index===0)lines.push("| "+row.values.map(()=> "---").join(" | ")+" |");
    });
    return "\n\n"+lines.join("\n")+"\n\n";
  });
  const codeBlocks = [];
  h=h.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre\s*>/gi,(_,code)=>{
    const lm=code.match(/<code\b[^>]*class=["'][^"']*language-([a-z0-9_+-]+)[^"']*["']/i);
    const body=decode(code.replace(/<\/?code\b[^>]*>/gi,""));
    const block="\n\n"+tick.repeat(3)+(lm?lm[1]:"")+"\n"+body.trim()+"\n"+tick.repeat(3)+"\n\n";
    codeBlocks.push(block);
    return "\n\n@@LLMS_CODE_BLOCK_"+(codeBlocks.length-1)+"@@\n\n";
  });
  h=h.replace(/<h1\b[^>]*>/gi,"\n\n# ").replace(/<\/h1\s*>/gi,"\n\n")
    .replace(/<h2\b[^>]*>/gi,"\n\n## ").replace(/<\/h2\s*>/gi,"\n\n")
    .replace(/<h3\b[^>]*>/gi,"\n\n### ").replace(/<\/h3\s*>/gi,"\n\n")
    .replace(/<h4\b[^>]*>/gi,"\n\n#### ").replace(/<\/h4\s*>/gi,"\n\n")
    .replace(/<(strong|b)\b[^>]*>/gi,"**").replace(/<\/(strong|b)\s*>/gi,"**")
    .replace(/<(em|i)\b[^>]*>/gi,"*").replace(/<\/(em|i)\s*>/gi,"*")
    .replace(/<code\b[^>]*>/gi,tick).replace(/<\/code\s*>/gi,tick)
    .replace(/<br\s*\/?>/gi,"\n")
    .replace(/<\/(p|div|section|header|article|aside|blockquote|figure|figcaption|ul|ol|li|table|thead|tbody|tr)\s*>/gi,"\n")
    .replace(/<(p|div|section|header|article|aside|figure|figcaption|blockquote|ul|ol|table|thead|tbody|tr)\b[^>]*>/gi,"\n")
    .replace(/<li\b[^>]*>/gi,"\n- ").replace(/<th\b[^>]*>/gi," | ").replace(/<td\b[^>]*>/gi," | ")
    .replace(/<[^>]+>/g," ");
  let out = decode(h).replace(/\r/g,"").replace(/[ \t]+\n/g,"\n").replace(/\n[ \t]+/g,"\n")
    .replace(/[ \t]{2,}/g," ").replace(/\n{3,}/g,"\n\n").replace(/^[ \t]+|[ \t]+$/gm,"").trim();
  return out.replace(/@@LLMS_CODE_BLOCK_(\d+)@@/g,(_,index)=>codeBlocks[Number(index)]);
}
function collect() {
  if(!fs.existsSync(POSTS))throw new Error("Posts directory not found: "+POSTS);
  const list=[];
  for(const f of scan(POSTS)){
    const html=fs.readFileSync(f.full,"utf8"),m=html.match(/<article\b[^>]*>([\s\S]*?)<\/article\s*>/i);
    if(!m){console.warn("[llms] Skipped "+f.rel+": no article element.");continue;}
    const j=articleJson(html)||{},h1=m[1].match(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i);
    const title=String(j.headline||(h1?h1[1].replace(/<[^>]+>/g," "):"")).replace(/\s+/g," ").trim();
    const date=String(j.datePublished||"").trim(),canonicalLinks=getLinksByRel(html,"canonical");
    if(canonicalLinks.length>1)throw new Error(f.rel+": multiple canonical link tags.");
    const url=canonicalLinks[0]||SITE+"/posts/"+f.rel.replace(/\.html$/i,"");
    const body=markdown(m[1],url),desc=String(meta(html,"description")||j.description||"").trim();
    if(!title||!date||!body){console.warn("[llms] Skipped "+f.rel+": missing title, publication date, or body.");continue;}
    list.push({title,date,modified:String(j.dateModified||date),url,description:desc,category:category(j.articleSection||""),body});
  }
  const seen=new Set();
  for(const a of list){if(seen.has(a.url))throw new Error("Duplicate canonical URL: "+a.url);seen.add(a.url);}
  list.sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(!list.length)throw new Error("No valid articles found; refusing to overwrite llms files.");
  return list;
}
function renderShort(articles) {
  const lines=["# MatrixQR Blog","","> The official MatrixQR technical blog covering QR code generation, digital menus, client-side processing, and practical privacy and security considerations.","","MatrixQR publishes implementation guides and product updates. Privacy and data-handling statements should be read in the context of the specific tool and workflow described. The MatrixQR Blog does not load Google Analytics; hosting providers and third-party assets may still process technical request data.","","## Official Resources","- [MatrixQR QR Code Generator](https://www.matrixqr.cc/): Main QR code generator website.","- [Digital Menu Tool](https://menu.matrixqr.cc/): Tools and workflows for digital menus.","- [Privacy Policy](https://blog.matrixqr.cc/posts/privacy-policy): The blog's privacy and data-handling disclosures.","","## Latest Articles"];
  for(const a of articles.slice(0,5))lines.push("- ["+a.title+"]("+a.url+"): "+(a.description||a.category));
  for(const c of CATEGORIES){const group=articles.filter(a=>a.category===c);if(!group.length)continue;lines.push("","## "+c);for(const a of group)lines.push("- ["+a.title+"]("+a.url+"): "+(a.description||a.category));}
  lines.push("","## Further Reading","- [Full Article Text Index](https://blog.matrixqr.cc/llms-full.txt): Markdown versions of the articles listed above.","- [XML Sitemap](https://blog.matrixqr.cc/sitemap.xml): Broader URL discovery for crawlers.","");
  return lines.join("\n");
}
function renderFull(articles) {
  const lines=["# MatrixQR Blog — Full Article Text","","> Machine-readable Markdown edition of MatrixQR Blog articles. Site navigation, scripts, and layout markup are excluded.","","## Site Information","","- Blog: https://blog.matrixqr.cc/","- Main QR generator: https://www.matrixqr.cc/","- Digital menu tool: https://menu.matrixqr.cc/","- Privacy policy: https://blog.matrixqr.cc/posts/privacy-policy","- Article count: "+articles.length,"","## Articles",""];
  for(const a of articles){lines.push("## "+a.title,"","- URL: "+a.url,"- Published: "+a.date,"- Updated: "+a.modified,"- Category: "+a.category);if(a.description)lines.push("- Description: "+a.description);lines.push("",a.body,"","---","");}
  return lines.join("\n").replace(/\n{3,}/g,"\n\n");
}
function write(file,content){fs.writeFileSync(file,content.endsWith("\n")?content:content+"\n","utf8");}
module.exports = { markdown, meta };

if (require.main === module) {
  try {
    const articles=collect(),short=renderShort(articles),full=renderFull(articles);
    if(!short.includes("# MatrixQR Blog")||!full.includes("## Articles")||articles.some(a=>!full.includes(a.url)))throw new Error("Basic output validation failed.");
    write(OUT,short);write(FULL,full);
    console.log("[llms] Articles included: "+articles.length);
    console.log("[llms] Updated llms.txt and llms-full.txt; duplicate URL and basic checks passed.");
  } catch(e) {
    console.error("[llms] ERROR: "+e.message);
    process.exit(1);
  }
}
