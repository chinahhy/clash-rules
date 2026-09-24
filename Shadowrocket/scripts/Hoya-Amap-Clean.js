// Hoya Amap Clean v1.1.0
// Shadowrocket response cleaner for Amap.
// Strategy: remove marketing payloads while keeping map/search/navigation core data.
// If an unknown response shape is encountered, return the original response unchanged.

const url = $request.url;
const raw = $response && $response.body;

if (!raw) {
  $done({});
} else {
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch (_) {
    $done({});
  }

  if (obj) {
    const del = (o, keys) => {
      if (!o) return;
      for (const k of keys) {
        if (Object.prototype.hasOwnProperty.call(o, k)) delete o[k];
      }
    };

    const clear = (o, keys) => {
      if (!o) return;
      for (const k of keys) {
        if (Array.isArray(o[k])) o[k] = [];
      }
    };

    const disableConfig = (o, keys) => {
      if (!o) return;
      for (const k of keys) {
        if (o[k]) o[k] = { status: 1, version: "", value: "" };
      }
    };

    try {
      // 首页：保留继续导航、常去地点、登录、找车，其余营销卡尽量清理。
      if (url.includes("/faas/amap-navigation/main-page")) {
        const d = obj.data;
        if (d) {
          if (Array.isArray(d.cardList)) {
            const keep = new Set(["ContinueNavigationCard","FrequentLocation","LoginCard"]);
            d.cardList = d.cardList.filter(x => keep.has(x?.dataKey || x?.dataType));
          }
          if (Array.isArray(d.mapBizList)) {
            d.mapBizList = d.mapBizList.filter(x => (x?.dataKey || x?.dataType) === "FindCarVirtualCard");
          }
          clear(d, ["business_position"]);
          if (d.pull3) clear(d.pull3, ["msgs"]);
          del(d, ["topBanner","operation","marketing","recommend","promotion","tips"]);
        }
      }

      // 路线规划首页：带 schema 的运营/推广卡片移除。
      else if (url.includes("/faas/amap-navigation/card-service-plan-home")) {
        if (Array.isArray(obj?.data?.children)) {
          obj.data.children = obj.data.children.filter(x => !(x && Object.prototype.hasOwnProperty.call(x, "schema")));
        }
      }

      // 驾车路线详情/规划：清助手皮肤、推荐语、广告事件。
      else if (url.includes("/perception/drive/routeInfo") || url.includes("/perception/drive/routePlan")) {
        const d = obj.data;
        if (d?.front_end) {
          del(d.front_end, ["assistant","global_guide_data","route_search","start_button_tips"]);
          if (Array.isArray(d.front_end.guide_tips)) {
            d.front_end.guide_tips = d.front_end.guide_tips.filter(x => x?.biz_type !== "music");
          }
          if (Array.isArray(d.front_end.download)) {
            d.front_end.download = d.front_end.download.filter(x => !/ads-\d+/.test(x?.dynamic_id_s || ""));
          }
        }
        if (Array.isArray(d?.tbt?.event)) {
          d.tbt.event = d.tbt.event.filter(x => !/ads-\d+/.test(x?.dynamic_id_s || ""));
        }
      }

      // 搜索运营数据。
      else if (url.includes("/shield/search_business/process/marketingOperationStructured")) {
        del(obj.data, ["commonMaterial","tipsOperationLocation","resourcePlacement"]);
      }

      // 搜索框热词。
      else if (url.includes("/shield/search/new_hotword") || url.includes("/shield/search_bff/hotword")) {
        const d = obj.data;
        clear(d, ["header_hotword","hotword","hotwords"]);
        del(d, ["recommend","promotion","operation"]);
      }

      // 搜索/POI详情：移除明显推广、优惠、相关推荐。
      else if (
        url.includes("/shield/search/poi/detail") ||
        url.includes("/shield/search/common/coupon/info") ||
        url.includes("/shield/search_poi/")
      ) {
        const d = obj.data;
        if (d) {
          del(d, [
            "CouponBanner","adv_compliance_info","adv_gift","bigListBizRec","brand_shop_bar",
            "city_discount","claim","co_branded_card","collector_guide","common_coupon_bar",
            "common_coupon_card","divergentRecommendModule","everyOneToSee","horizontalGoodsShelf",
            "image_banner","listBizRec_1","listBizRec_2","membership","movie_info",
            "nearbyRecommendModule","nearby_play_rec","newGuest","newRelatedRecommends",
            "new_operation_banner","operation_banner","portal_entrance","poster_banner",
            "relatedRecommends","tips_operation_info","promotion_wrap_card","hookInfo"
          ]);
          if (d.district?.poi_list?.[0]) {
            del(d.district.poi_list[0], ["transportation","feed_rec_tab"]);
          }
          const list = d.list_data?.content?.[0];
          if (list) {
            del(list, ["tips_operation_info","promotion_wrap_card","hookInfo"]);
            if (list.map_bottom_bar) del(list.map_bottom_bar, ["hotel"]);
          }
        }
      }

      // “我的”：保留订单相关，移除会员/运营推荐。
      else if (url.includes("/shield/dsp/profile/index/nodefaas")) {
        const d = obj.data;
        if (d) {
          del(d, ["tipData","memberInfo","topMixedCard"]);
          if (Array.isArray(d.cardList)) {
            d.cardList = d.cardList.filter(x => {
              const k = x?.dataKey || x?.dataType;
              return k === "MyOrderCard";
            });
          }
        }
      }

      // 附近页：清活动、优惠券、商品/运营推荐。
      else if (url.includes("/shield/search/nearbyrec_smart")) {
        const d = obj.data;
        const bad = new Set(["coupon","scene","activity","commodity_rec","operation_activity"]);
        if (d) {
          for (const k of bad) delete d[k];
          if (Array.isArray(d.modules)) d.modules = d.modules.filter(x => !bad.has(x));
        }
      }

      // 开屏广告。
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

      // 打车/运营资源。
      else if (url.includes("/promotion-web/resource")) {
        del(obj.data, ["alpha","banner","bravo","bubble","charlie","icon","other","popup","push","tips"]);
      }

      // 打车订单页常见推广。
      else if (url.includes("/boss/car/order/content_info")) {
        if (Array.isArray(obj?.data?.lubanData?.skin?.dataList)) obj.data.lubanData.skin.dataList = [];
      }

      else if (url.includes("/boss/order_web/friendly_information")) {
        const d = obj?.data?.["105"];
        del(d, ["banners","carouselTips","integratedBanners","integratedTips","skins","skinAndTips","tips"]);
      }

      else if (url.includes("/sharedtrip/taxi/order_detail_car_tips")) {
        if (obj?.data?.carTips?.data) del(obj.data.carTips.data, ["popupInfo"]);
      }

      // 消息中心运营消息。
      else if (url.includes("/msgbox/pull") || url.includes("/message/notice/list")) {
        clear(obj, ["msgs"]);
        if (obj.pull3) clear(obj.pull3, ["msgs"]);
        if (obj.data) clear(obj.data, ["msgs","noticeList"]);
      }

      // 高德远程运营开关：关闭明显营销模块。
      else if (url.includes("/shield/frogserver/aocs")) {
        disableConfig(obj.data, [
          "Naviendpage_Searchwords","SplashScreenControl","TipsTaxiButton","amapCoin",
          "feedback_banner","home_business_position_config","nearby_business_popup",
          "nearby_map_entry_guide","nearby_map_pull_down_guide","operation_layer",
          "route_banner","routeresult_banner","search_homepage","search_keyword",
          "search_moni","search_poi_recommend","small_biz_case","splashscreen",
          "splashview_config","sur_bar","taxi_activity","vip"
        ]);
      }

      $done({ body: JSON.stringify(obj) });
    } catch (_) {
      $done({});
    }
  }
}
