'use strict';
// Local, compressed, content-addressed GPU geometry cache.
// The full cache key includes the immutable world seed, known terrain state,
// generator revision and settings. App release version is intentionally absent.
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const zlib=require('node:zlib');
const {promisify}=require('node:util');
const gzip=promisify(zlib.gzip),gunzip=promisify(zlib.gunzip);

const FORMAT=1;
const MAX_COMPRESSED=4*1024*1024;
const MAX_EXPANDED=24*1024*1024;
const MAX_TOTAL_BYTES=512*1024*1024;
const MAX_FILES=18000;

function validateNumbers(arr,divisor=3){
  return Array.isArray(arr)&&arr.length%divisor===0&&arr.length<=3_000_000
    &&arr.every(n=>typeof n==='number'&&Number.isFinite(n));
}
function validateChunk(data){
  if(!data||data.format!==FORMAT||!validateNumbers(data.positions)
    ||!validateNumbers(data.colors)||data.positions.length!==data.colors.length
    ||data.positions.length<9
    ||(data.waves!==null&&!validateNumbers(data.waves,3))
    ||!Array.isArray(data.instances)||data.instances.length>4
    ||!Number.isSafeInteger(data.faces)||data.faces<0
    ||!Number.isSafeInteger(data.trees)||data.trees<0)return false;
  const names=new Set(['trunk','broad','conifer']);
  return data.instances.every(p=>names.has(p.type)&&validateNumbers(p.matrices,16));
}
class TerrainMeshDiskCache{
  constructor(userDataDir,{maxBytes=MAX_TOTAL_BYTES,maxFiles=MAX_FILES}={}){
    this.directory=path.join(userDataDir,'terrain-mesh-cache-v1');
    this.maxBytes=maxBytes;this.maxFiles=maxFiles;
    this.writeCount=0;
  }
  fileFor(key){
    if(typeof key!=='string'||key.length<8||key.length>30000)throw Error('Invalid terrain cache key');
    const digest=crypto.createHash('sha256').update(key).digest('hex');
    return path.join(this.directory,digest.slice(0,2),digest+'.mesh.gz');
  }
  async read(key){
    const file=this.fileFor(key);
    try{
      const stat=await fs.stat(file);
      if(stat.size>MAX_COMPRESSED||stat.size<20)throw Error('Invalid compressed cache size');
      const packed=await fs.readFile(file);
      const bytes=await gunzip(packed,{maxOutputLength:MAX_EXPANDED});
      const parsed=JSON.parse(bytes.toString('utf8'));
      if(parsed.key!==key||!validateChunk(parsed.mesh))throw Error('Stale or corrupted terrain cache');
      // Best-effort LRU touch; never block a render for it.
      fs.utimes(file,new Date(),new Date()).catch(()=>{});
      return parsed.mesh;
    }catch(error){
      if(error.code!=='ENOENT')await fs.unlink(file).catch(()=>{});
      return null;
    }
  }
  async write(key,mesh){
    if(!validateChunk(mesh))throw Error('Invalid terrain mesh payload');
    const file=this.fileFor(key);
    const output=Buffer.from(JSON.stringify({key,mesh}),'utf8');
    if(output.length>MAX_EXPANDED)throw Error('Terrain mesh exceeds uncompressed limit');
    const compressed=await gzip(output,{level:4});
    if(compressed.length>MAX_COMPRESSED)throw Error('Terrain mesh exceeds compressed limit');
    await fs.mkdir(path.dirname(file),{recursive:true});
    const temporary=file+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';
    try{
      await fs.writeFile(temporary,compressed,{flag:'wx'});
      // Existing matching key may be in concurrent use. Atomic replacement is
      // safe on the target Windows filesystem after unlinking identical data.
      try{await fs.rename(temporary,file);}
      catch(error){
        if(error.code!=='EEXIST'&&error.code!=='EPERM')throw error;
        await fs.unlink(temporary).catch(()=>{});
      }
    }finally{await fs.unlink(temporary).catch(()=>{});}
    if(++this.writeCount%64===0)await this.prune().catch(()=>{});
    return true;
  }
  async prune(){
    const files=[],pending=[this.directory];
    while(pending.length){
      const dir=pending.pop();
      for(const entry of await fs.readdir(dir,{withFileTypes:true}).catch(()=>[])){
        const p=path.join(dir,entry.name);
        if(entry.isDirectory())pending.push(p);
        else if(entry.isFile()&&entry.name.endsWith('.mesh.gz')){
          const stat=await fs.stat(p).catch(()=>null);
          if(stat)files.push({p,age:stat.mtimeMs,size:stat.size});
        }
      }
    }
    let bytes=files.reduce((a,b)=>a+b.size,0);
    if(bytes<=this.maxBytes&&files.length<=this.maxFiles)return;
    files.sort((a,b)=>a.age-b.age);
    while(files.length&&(bytes>this.maxBytes||files.length>this.maxFiles)){
      const oldest=files.shift();
      await fs.unlink(oldest.p).catch(()=>{});
      bytes-=oldest.size;
    }
  }
}
module.exports={TerrainMeshDiskCache,validateChunk,FORMAT};
