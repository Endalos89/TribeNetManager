'use strict';
const assert=require('node:assert/strict');
const os=require('node:os'),fs=require('node:fs/promises'),path=require('node:path');
const {TerrainMeshDiskCache,validateChunk}=require('../src/terrain-mesh-disk-cache');

(async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tribenet-terrain-cache-'));
  try{
    const first=new TerrainMeshDiskCache(directory,{maxFiles:2});
    const mesh={format:2,faces:2,coreFaces:1,sharedFaces:1,trees:2,
      positions:[0,0,.5,1,0,.5,0,1,.5],
      colors:[.25,.5,.75,.25,.5,.75,.25,.5,.75],
      sharedPositions:[0,0,.5,-1,0,.5,0,-1,.5],
      sharedColors:[.25,.5,.75,.25,.5,.75,.25,.5,.75],
      waves:null,instances:[{type:'trunk',matrices:Array.from({length:32},(_,i)=>i%5===0?1:0)}]};
    assert.equal(validateChunk(mesh),true);
    const transferable={...mesh,
      positions:Float32Array.from(mesh.positions),
      colors:Float32Array.from(mesh.colors),
      sharedPositions:Float32Array.from(mesh.sharedPositions),
      sharedColors:Float32Array.from(mesh.sharedColors),
      instances:[{type:'trunk',matrices:Float32Array.from(mesh.instances[0].matrices)}]
    };
    assert.equal(validateChunk(transferable),true,
      'typed IPC buffers must be supported without frontend serialization');
    const typedKey='typed-mesh-geometry-cache-key';
    await first.write(typedKey,transferable);
    const typedCopy=await new TerrainMeshDiskCache(directory).read(typedKey);
    assert.equal(typedCopy.positions.length,mesh.positions.length);
    for(let i=0;i<mesh.positions.length;i++)
      assert.ok(Math.abs(typedCopy.positions[i]-mesh.positions[i])<1e-6);
    assert.equal(typedCopy.instances[0].matrices.length,32);
    assert.equal(validateChunk({...mesh,positions:[NaN,1,2]}),false);
    assert.equal(validateChunk({...mesh,instances:[{type:'person',matrices:[]}]}),false);

    const persistentKey=JSON.stringify(['terrain-fixed8-shore-components-20261024-r2',1790425012,
      '152:163',8,[['waterHeight',.5]],[['PK1719','PR'],['PK1819','O']]]);
    const otherHistory=persistentKey.replace('PK1819","O','PK1819","?');
    const otherPreset=persistentKey.replace('waterHeight",0.5','waterHeight",0.3');
    assert.equal(await first.read(persistentKey),null,'first visit requires generation');
    await first.write(persistentKey,mesh);
    const file=first.fileFor(persistentKey);
    assert.ok((await fs.stat(file)).size>0,'compressed geometry written to disk');
    const restarted=new TerrainMeshDiskCache(directory);
    assert.deepEqual(await restarted.read(persistentKey),mesh,
      'second application instance restores exactly the same mesh and tree instances');
    assert.equal(await restarted.read(otherHistory),null,
      'an earlier turn must never reveal a future known coastline');
    assert.equal(await restarted.read(otherPreset),null,
      'different terrain settings must regenerate only the new fingerprint');
    // A corrupt file must be ignored/deleted, not crash the application.
    await fs.writeFile(file,Buffer.from('not a valid compressed mesh'));
    assert.equal(await restarted.read(persistentKey),null,'corruption falls back to generation');
    await assert.rejects(()=>fs.stat(file),{code:'ENOENT'});
    await restarted.write(persistentKey,mesh);
    assert.deepEqual(await restarted.read(persistentKey),mesh,'corruption is recoverable');

    const a=JSON.stringify(['a',persistentKey]),b=JSON.stringify(['b',persistentKey]);
    await first.write(a,mesh);await first.write(b,mesh);
    await first.prune();
    assert.ok((await first.read(b))!==null,'recent cached meshes survive bounded cleanup');
    const all=await fs.readdir(first.directory,{recursive:true});
    assert.ok(all.filter(file=>file.endsWith('.mesh.gz')).length<=2,'disk cache is bounded');

    console.log('Persistent terrain mesh cache: exact restart restore, isolation, corruption recovery and pruning passed');
  }finally{await fs.rm(directory,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
