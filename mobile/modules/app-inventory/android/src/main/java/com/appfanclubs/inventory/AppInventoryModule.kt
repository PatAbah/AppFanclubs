package com.appfanclubs.inventory

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Process
import android.provider.Settings
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import androidx.work.WorkManager
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.Constraints
import androidx.work.NetworkType
import java.util.concurrent.TimeUnit
import org.json.JSONArray

class AppInventoryModule : Module() {
  private fun granted(context: Context): Boolean {
    val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    return ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName) == AppOpsManager.MODE_ALLOWED
  }
  override fun definition() = ModuleDefinition {
    Name("AppInventory")
    AsyncFunction("configure") { baseUrl: String ->
      val context = appContext.reactContext ?: throw Exception("No context")
      val uri = java.net.URI(baseUrl)
      require(uri.scheme == "https" && !uri.host.isNullOrEmpty() && uri.userInfo == null && uri.query == null && uri.fragment == null && (uri.path.isNullOrEmpty() || Regex("^/(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_-]*$").matches(uri.path))) { "Invalid app URL" }
      context.getSharedPreferences("fanclubs", Context.MODE_PRIVATE).edit().putString("apiBaseUrl", baseUrl.trimEnd('/')).commit()
      true
    }
    AsyncFunction("getApps") {
      val context = appContext.reactContext ?: throw Exception("No context")
      val pm = context.packageManager
      val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      val hasUsage = granted(context)
      val usage = if (hasUsage) {
        val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        manager.queryAndAggregateUsageStats(System.currentTimeMillis() - 14L * 86400000L, System.currentTimeMillis())
      } else emptyMap()
      val apps = pm.queryIntentActivities(intent, 0).map { it.activityInfo.applicationInfo }.distinctBy { it.packageName }
        .filter { it.packageName != context.packageName && ((it.flags and ApplicationInfo.FLAG_SYSTEM) == 0 || (it.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0) }
        .map { info ->
          val icon = pm.getApplicationIcon(info)
          val bitmap = Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888)
          val canvas = Canvas(bitmap)
          icon.setBounds(0, 0, 64, 64); icon.draw(canvas)
          val bytes = ByteArrayOutputStream()
          bitmap.compress(Bitmap.CompressFormat.PNG, 100, bytes); bitmap.recycle()
          mapOf<String, Any>("package" to info.packageName, "name" to pm.getApplicationLabel(info).toString(), "icon" to "data:image/png;base64,${Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP)}", "usage" to (usage[info.packageName]?.totalTimeInForeground ?: 0L))
        }.sortedWith(compareByDescending<Map<String, Any>> { if(hasUsage) it["usage"] as Long else 0L }.thenBy { (it["name"] as String).lowercase() })
      mapOf("apps" to apps, "usageGranted" to hasUsage)
    }
    Function("openUsageAccess") {
      val context = appContext.reactContext ?: throw Exception("No context")
      context.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      true
    }
    AsyncFunction("setSelected") { packages: List<String> ->
      val context = appContext.reactContext ?: throw Exception("No context")
      context.getSharedPreferences("fanclubs", Context.MODE_PRIVATE).edit().putString("selected", JSONArray(packages).toString()).apply()
      val work = PeriodicWorkRequestBuilder<InventoryWorker>(6, TimeUnit.HOURS)
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build()
      WorkManager.getInstance(context).enqueueUniquePeriodicWork("fanclubs-selected-apps", ExistingPeriodicWorkPolicy.UPDATE, work)
      true
    }
  }
}
