'use strict';
// Bundle the worker's pure terrain code into the local renderer without
// file:// Worker origin restrictions or network dependencies.
const fs=require('node:fs');
const path=require('node:path');
const esbuild=require('esbuild');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,'src',name),'utf8');
const worker=[read('terrain-settings.js'),read('isometric-core.js'),
  read('terrain-geometry-worker.js').replace(
    "importScripts('./terrain-settings.js','./isometric-core.js');",'')].join('\n');
esbuild.build({
  entryPoints:[path.join(root,'src/isometric-webgl.js')],
  bundle:true,platform:'browser',format:'iife',target:['chrome125'],
  outfile:path.join(root,'src/isometric-webgl.bundle.js'),
  plugins:[{
    name:'embedded-offline-geometry-worker',
    setup(build){
      build.onResolve({filter:/^virtual:tribenet-geometry-worker$/},()=>({
        path:'source',namespace:'tribenet-worker'
      }));
      build.onLoad({filter:/.*/,namespace:'tribenet-worker'},()=>({
        contents:'export default '+JSON.stringify(worker)+';',loader:'js'
      }));
    }
  }]
}).catch(error=>{console.error(error);process.exitCode=1;});
