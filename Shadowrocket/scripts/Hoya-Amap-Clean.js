// Hoya Amap Clean v1.2.0
// Shadowrocket response cleaner for Amap.
// Updated against Amap 16.25.2 traffic observed on 2026-09-24.
// Unknown response shapes are passed through unchanged.

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

    const disableConfig = (o, keys, status = 1) => {
      if (!o) return;
      for (const k of keys) {
        if (Object.prototype.hasOwnProperty.call(o, k)) {
          o[k] = { status, version: "", value: "" };
        }
      }
    };

    try {
      if (url.includes("/faas/amap-navigation/main-page")) {
        const d = obj.data;
        if (d) {
          if (Array.isArray(d.cardList)) {
            const keep = new Set(["ContinueNavigationCard", "FrequentLocation", "LoginCard"]);
            d.cardList = d.cardList.filter(x => keep.has(x?.dataKey || x?.dataType));
          }
          if (Array.isArray(d.mapBizList)) {
            d.mapBizList = d.mapBizList.filter(x => (x?.dataKey || x?.dataType) === "FindCarVirtualCard");
          }
          if (d.pull3) clear(d.pull3, ["msgs"]);
          clear(d, ["business_position"]);
          del(d, ["topBanner", "operation", "marketing", "recommend", "promotion", "tips"]);
        }
      }

      else if (url.includes("/faas/amap-navigation/card-service-plan-home")) {
        if (Array.isArray(obj?.data?.children)) {
          obj.data.children = obj.data.children.filter(x => !(x && Object.prototype.hasOwnProperty.call(x, "schema")));
        }
      }

      else if (url.includes("/aos/perception/publicTravel/beforeNavi")) {
        const d = obj?.data;
        if (d?.common_data?.bus_plan_bottom_event) d.common_data.bus_plan_bottom_event.data = [];
        if (d?.common_data?.bus_plan_bottom_tips) d.common_data.bus_plan_bottom_tips.data = [];
        if (d?.common_data?.bus_plan_segment_event) d.common_data.bus_plan_segment_event.data = [];
        if (Array.isArray(d?.front_end?.assistant)) d.front_end.assistant = [];
      }

      else if (url.includes("/bus/plan/integrate")) {
        const d = obj?.data;
        if (d?.banner_lists) {
          if (Array.isArray(d.banner_lists.data)) d.banner_lists.data = [];
          if (Array.isArray(d.banner_lists.tips)) d.banner_lists.tips = [];
        }
        if (Array.isArray(d?.mixed_plans?.data?.taxiPlans)) d.mixed_plans.data.taxiPlans = [];
      }

      else if (url.includes("/perception/drive/routeInfo") || url.includes("/perception/drive/routePlan")) {
        const d = obj.data;
        if (d?.front_end) {
          del(d.front_end, ["assistant", "global_guide_data", "route_search", "start_button_tips"]);
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

      else if (url.includes("/c3frontend/af-hotel/page/main")) {
        const m = obj?.data?.modules;
        if (m) {
          del(m, ["CouponPortalCard", "CouponWidget", "recommended_list"]);
          const u = m?.user_filter_card?.data;
          if (u) {
            del(u, ["banner", "bannerList", "service_data", "sug_items_data"]);
            if (u.search_button_data) del(u.search_button_data, ["rightbgText"]);
          }
        }
      }

      else if (url.includes("/c3frontend/af-launch/page/main")) {
        if (obj?.data?.modules?.C1EndNaviEngine) obj.data.modules.C1EndNaviEngine.data = {};
      }

      else if (url.includes("/c3frontend/af-nearby/nearby")) {
        const m = obj?.data?.modules;
        if (m) {
          if (m.banner) m.banner = {};
          if (m.contentPoster) m.contentPoster = {};
        }
      }

      else if (url.includes("/shield/search_business/process/marketingOperationStructured")) {
        del(obj.data, ["commonMaterial", "tipsOperationLocation", "resourcePlacement"]);
      }

      else if (url.includes("/shield/search/new_hotword") || url.includes("/shield/search_bff/hotword")) {
        const d = obj.data;
        clear(d, ["header_hotword", "hotword", "hotwords"]);
        del(d, ["recommend", "promotion", "operation"]);
      }

      else if (
        url.includes("/shield/search/poi/detail") ||
        url.includes("/shield/search/common/coupon/info") ||
        url.includes("/shield/search_poi/")
      ) {
        const d = obj.data;
        if (url.includes("/shield/search/common/coupon/info") && d) {
          obj.data = {};
        } else if (d) {
          del(d, [
            "CouponBanner", "CouponPush", "adStoreBigBannerModule", "adv_compliance_info", "adv_gift",
            "bigListBizRec", "bottomDescription", "brand_service", "brand_shop_bar",
            "businessQualifications", "carServiceCard", "city_discount", "claim", "co_branded_card",
            "collector_guide", "commonAiAgent", "commonGoodsShelf", "common_coupon_bar",
            "common_coupon_card", "comprehensiveEditEntrance", "dayTripList", "discount_commodity",
            "divergentRecommendModule", "enhanceCustomerServiceFixedBottom",
            "enhanceCustomerServicePoiModule", "everyOneToSee", "horizontalGoodsShelf",
            "hospital_strategy", "hotPlay", "hotelCoupon", "hotelList", "image_banner",
            "kaMarketingCampaign", "kaProductMixServiceShelf", "ka_not_enter",
            "legSameIndustryRecEntrance", "listBizRec_1", "listBizRec_2", "matrix_banner",
            "merchantSettlement", "membership", "mini_hook_shelf", "movie_info",
            "nearbyGoodCar", "nearbyRecommendModule", "nearby_play_rec", "newGuest",
            "newRelatedRecommends", "new_operation_banner", "operation_banner", "packageShelf",
            "parentPoiRecEntrance", "poiDetailBottomBarOperation", "poiDetailNewBeltV2",
            "poiDetailWaterFeed", "poiDetailWaterFeedTitle", "portal_entrance", "poster_banner",
            "quickLink", "relatedRecommends", "tips_operation_info", "promotion_wrap_card", "hookInfo"
          ]);
          if (d.district?.poi_list?.[0]) {
            del(d.district.poi_list[0], ["transportation", "feed_rec_tab"]);
          }
          const list = d.list_data?.content?.[0];
          if (list) {
            del(list, ["tips_operation_info", "promotion_wrap_card", "hookInfo"]);
            if (list.map_bottom_bar) del(list.map_bottom_bar, ["hotel"]);
          }
        }
      }

      else if (url.includes("/shield/dsp/profile/index/nodefaas")) {
        const d = obj.data;
        if (d) {
          del(d, ["tipData", "memberInfo", "topMixedCard"]);
          if (Array.isArray(d.cardList)) {
            d.cardList = d.cardList.filter(x => (x?.dataKey || x?.dataType) === "MyOrderCard");
          }
        }
      }

      else if (url.includes("/shield/search/nearbyrec_smart")) {
        const d = obj.data;
        const bad = new Set(["coupon", "scene", "activity", "commodity_rec", "operation_activity"]);
        if (d) {
          for (const k of bad) delete d[k];
          if (Array.isArray(d.modules)) d.modules = d.modules.filter(x => !bad.has(x));
        }
      }

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

      else if (url.includes("/promotion-web/resource")) {
        del(obj.data, ["alpha", "banner", "bravo", "bubble", "charlie", "icon", "other", "popup", "push", "tips"]);
      }

      else if (url.includes("/boss/car/order/content_info")) {
        if (Array.isArray(obj?.data?.lubanData?.popup?.dataList)) obj.data.lubanData.popup.dataList = [];
        if (Array.isArray(obj?.data?.lubanData?.skin?.dataList)) obj.data.lubanData.skin.dataList = [];
        if (Array.isArray(obj?.data?.matrixData?.c3DiversionCard?.dataList)) obj.data.matrixData.c3DiversionCard.dataList = [];
        if (Array.isArray(obj?.data?.matrixData?.DiversionCard?.dataList)) obj.data.matrixData.DiversionCard.dataList = [];
      }

      else if (url.includes("/boss/order_web/friendly_information")) {
        const d = obj?.data?.["105"];
        del(d, ["banners", "carouselTips", "integratedBanners", "integratedTips", "skins", "skinAndTips", "tips"]);
      }

      else if (url.includes("/sharedtrip/taxi/order_detail_car_tips")) {
        if (obj?.data?.carTips?.data) del(obj.data.carTips.data, ["popupInfo"]);
      }

      else if (url.includes("/msgbox/pull") || url.includes("/message/notice/list")) {
        clear(obj, ["msgs"]);
        if (obj.pull3) clear(obj.pull3, ["msgs"]);
        if (obj.data) clear(obj.data, ["msgs", "noticeList"]);
      }

      else if (url.includes("/shield/frogserver/aocs/updatable/")) {
        const d = obj.data;

        disableConfig(d, [
          "Naviendpage_Searchwords", "SplashScreenControl", "TipsTaxiButton", "amapCoin",
          "favorites_info", "feedback_banner", "footprint", "his_input_tip",
          "home_business_position_config", "hotel_activity", "hotel_fillin_opt", "hotel_loop",
          "hotel_tipsicon", "hotsaleConfig", "landing_page_info", "map_weather_switch", "maplayers",
          "navi_end", "nearby_business_popup", "nearby_map_entry_guide", "nearby_map_pull_down_guide",
          "operation_layer", "poi_rec", "preword", "route_banner", "routeresult_banner",
          "search_homepage", "search_keyword", "search_moni", "search_perf", "search_poi_recommend",
          "search_service_adcode", "search_word", "sportsGroupConfig", "sportsHealthConfig",
          "sportsHomeConfig", "sportsRouteConfig", "sportsTaskConfig", "sports_walk",
          "small_biz_b2b_kb", "small_biz_case", "small_biz_fun", "small_biz_index",
          "small_biz_news", "splashscreen", "splashview_config", "sur_bar", "taxi_activity",
          "testflight_adiu", "tf_remind", "tips_bar_black_list", "vip"
        ]);

        disableConfig(d, [
          "aiNativeV16", "aiNative1520", "ai_agent_enter_style_cursor", "ai_scenes",
          "aiNativeRC06", "plan_ai", "ai_native_smart_island"
        ]);
        disableConfig(d, ["llm"], 2);
      }

      $done({ body: JSON.stringify(obj) });
    } catch (_) {
      $done({});
    }
  }
}
