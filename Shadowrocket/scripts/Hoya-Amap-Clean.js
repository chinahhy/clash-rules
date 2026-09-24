// Hoya Amap Clean v1.0
// Shadowrocket HTTP response script.
// Goal: clean common promotion/marketing UI while keeping core map, search and navigation functions.

const url = $request.url;
if (!$response || !$response.body) {
  $done({});
}

let obj;
try {
  obj = JSON.parse($response.body);
} catch (e) {
  $done({});
}

function emptyArray(parent, key) {
  if (parent && Array.isArray(parent[key])) parent[key] = [];
}

function removeKeys(parent, keys) {
  if (!parent) return;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(parent, key)) delete parent[key];
  }
}

try {
  // 首页：保留继续导航 / 常去地点 / 登录卡片 / 找车卡片，清掉营销与消息位。
  if (url.includes("/faas/amap-navigation/main-page")) {
    const data = obj.data;
    if (data) {
      if (Array.isArray(data.cardList)) {
        const keep = new Set(["ContinueNavigationCard", "FrequentLocation", "LoginCard"]);
        data.cardList = data.cardList.filter(item => keep.has(item?.dataKey || item?.dataType));
      }
      if (Array.isArray(data.mapBizList)) {
        data.mapBizList = data.mapBizList.filter(item => (item?.dataKey || item?.dataType) === "FindCarVirtualCard");
      }
      if (data.pull3 && Array.isArray(data.pull3.msgs)) data.pull3.msgs = [];
      emptyArray(data, "business_position");
      removeKeys(data, ["topBanner", "operation", "marketing", "recommend"]);
    }
  }

  // 路线规划首页：带 schema 的推广卡片通常不是核心导航内容。
  else if (url.includes("/faas/amap-navigation/card-service-plan-home")) {
    const children = obj?.data?.children;
    if (Array.isArray(children)) {
      obj.data.children = children.filter(item => !(item && Object.prototype.hasOwnProperty.call(item, "schema")));
    }
  }

  // “我的”：保留订单卡，清推广提示、会员营销和顶部混合推广。
  else if (url.includes("/shield/dsp/profile/index/nodefaasv3")) {
    const data = obj.data;
    if (data) {
      removeKeys(data, ["tipData", "memberInfo", "topMixedCard"]);
      if (Array.isArray(data.cardList)) {
        data.cardList = data.cardList.filter(item => {
          const k = item?.dataKey || item?.dataType;
          return k === "MyOrderCard";
        });
      }
    }
  }

  // 搜索框热词 / 推荐词。
  else if (url.includes("/shield/search/new_hotword") || url.includes("/shield/search_bff/hotword")) {
    if (obj.data) {
      emptyArray(obj.data, "header_hotword");
      emptyArray(obj.data, "hotword");
      emptyArray(obj.data, "hotwords");
      removeKeys(obj.data, ["recommend", "promotion"]);
    }
  }

  // 附近：去优惠券、活动、商品推荐等运营模块，保留核心附近内容。
  else if (url.includes("/shield/search/nearbyrec_smart")) {
    const data = obj.data;
    if (data) {
      const remove = new Set(["coupon", "scene", "activity", "commodity_rec", "operation_activity"]);
      for (const key of remove) delete data[key];
      if (Array.isArray(data.modules)) {
        data.modules = data.modules.filter(item => !remove.has(item));
      }
    }
  }

  // 开屏广告：让广告立即失效。
  else if (url.includes("/valueadded/alimama/splash_screen")) {
    const ads = obj?.data?.ad;
    if (Array.isArray(ads)) {
      for (const ad of ads) {
        if (ad?.set?.setting) ad.set.setting.display_time = 0;
        if (Array.isArray(ad?.creative)) {
          for (const c of ad.creative) {
            c.start_time = 2240150400;
            c.end_time = 2240150400;
          }
        }
      }
    }
  }

  // 打车/运营资源：清横幅、气泡、弹窗等营销位。
  else if (url.includes("/promotion-web/resource")) {
    const data = obj.data;
    removeKeys(data, ["alpha", "banner", "bravo", "bubble", "charlie", "icon", "other", "popup", "push", "tips"]);
  }

  // 消息中心运营消息。
  else if (url.includes("/msgbox/pull")) {
    emptyArray(obj, "msgs");
    if (obj.pull3) emptyArray(obj.pull3, "msgs");
    if (obj.data) emptyArray(obj.data, "msgs");
  }

  // 远程运营开关：仅关闭明显营销/首页浮层项。
  else if (url.includes("/shield/frogserver/aocs")) {
    const data = obj.data;
    const targets = [
      "Naviendpage_Searchwords",
      "SplashScreenControl",
      "amapCoin",
      "home_business_position_config",
      "nearby_business_popup",
      "operation_layer",
      "route_banner",
      "routeresult_banner",
      "search_keyword",
      "small_biz_case",
      "splashscreen",
      "splashview_config",
      "taxi_activity",
      "vip"
    ];
    if (data) {
      for (const key of targets) {
        if (data[key]) data[key] = { status: 1, version: "", value: "" };
      }
    }
  }

  $done({ body: JSON.stringify(obj) });
} catch (e) {
  // 出现未预期结构时保留原响应，优先保证地图可用。
  $done({});
}
