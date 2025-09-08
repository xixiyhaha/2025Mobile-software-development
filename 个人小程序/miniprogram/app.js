// app.js
App({
    onLaunch() {
      // 初始化云开发环境
      if (!wx.cloud) {
        console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      } else {
        wx.cloud.init({
          traceUser: true,
        })
      }
  
      // 检查用户是否已登录
      const userInfo = wx.getStorageSync('userInfo')
      if (!userInfo) {
        // 未登录，跳转到登录页
        wx.navigateTo({
          url: '/pages/login/login'
        })
      } else {
        this.globalData.userInfo = userInfo
      }
    },
    globalData: {
      userInfo: null,
      // 底部导航配置
      tabBarList: [
        {
          pagePath: "/pages/index/index",
          text: "点歌台",
          iconPath: "/images/tab/song-default.png",
          selectedIconPath: "/images/tab/song-selected.png"
        },
        {
          pagePath: "/pages/calendar/calendar",
          text: "日历",
          iconPath: "/images/tab/calendar-default.png",
          selectedIconPath: "/images/tab/calendar-selected.png"
        },
        {
          pagePath: "/pages/mine/mine",
          text: "我的",
          iconPath: "/images/tab/mine-default.png",
          selectedIconPath: "/images/tab/mine-selected.png"
        }
      ]
    }
  })
      