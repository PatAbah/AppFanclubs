package com.appfanclubs.inventory

import android.content.Context
import android.content.Intent
import android.webkit.CookieManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.net.URL
import javax.net.ssl.HttpsURLConnection
import org.json.JSONArray
import org.json.JSONObject

class InventoryWorker(context: Context, params: WorkerParameters): Worker(context, params) {
  override fun doWork(): Result {
    val base = applicationContext.getSharedPreferences("fanclubs", Context.MODE_PRIVATE).getString("apiBaseUrl", null) ?: return Result.success()
    return try {
      val selected = applicationContext.getSharedPreferences("fanclubs", Context.MODE_PRIVATE).getString("selected", null) ?: return Result.success()
      val cookie = CookieManager.getInstance().getCookie(base) ?: return Result.success()
      val ids = JSONArray(selected)
      val pm = applicationContext.packageManager
      val installed = pm.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER), 0)
        .map { it.activityInfo.applicationInfo }.associateBy { it.packageName }
      val apps = JSONArray()
      for (i in 0 until ids.length()) {
        val packageName = ids.getString(i)
        val info = installed[packageName] ?: continue
        apps.put(JSONObject().put("package", packageName).put("name", pm.getApplicationLabel(info).toString()))
      }
      val connection = URL("$base/api/inventory").openConnection() as HttpsURLConnection
      connection.requestMethod = "POST"
      connection.connectTimeout = 15000; connection.readTimeout = 15000
      connection.setRequestProperty("Cookie", cookie)
      connection.setRequestProperty("Content-Type", "application/json")
      connection.setRequestProperty("X-Requested-With", "AppFanclubs")
      connection.doOutput = true
      connection.outputStream.use { it.write(JSONObject().put("platform", "android").put("apps", apps).toString().toByteArray()) }
      val code = connection.responseCode
      connection.disconnect()
      if (code >= 500) Result.retry() else Result.success()
    } catch (_: Exception) { Result.retry() }
  }
}
