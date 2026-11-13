const {withAndroidManifest}=require('@expo/config-plugins');
module.exports=config=>withAndroidManifest(config,config=>{
 const m=config.modResults.manifest;
 m.queries=[{intent:[{action:[{$:{'android:name':'android.intent.action.MAIN'}}],category:[{$:{'android:name':'android.intent.category.LAUNCHER'}}]}]}];
 return config;
});
