// index.js

Page({
    data: {
          name:'hello world',
          src:'/images/wx.jpg'
    },
    onLoad() {
        if (wx.getUserProfile) {
          this.setData({
              canIUseGetUserprofile:true
          })
        }
    },
    //获取用户信息
    getProfile: function(e) {
      //推荐使用wx.getuserProfile获取用户信息，开发者每次通过该接口获取用户个人信息均需用户确认，
      // 开发者妥善保管用户快速填写的头像昵称，避免重复弹窗
      wx.getUserProfile({
        desc: '展示用户信息', // 声明获取用户个人信息后的用途，后续会展示在弹窗中
        success: (res) => {
          console.log(res)
          this.setData({
            src: res.userInfo.avatarUrl,
            name:res.userInfo.nickName,
          })
        }
      })
    } 
  ,
  })