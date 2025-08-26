// pages/index/index.js
Page({
  /* 页面的初始数据 */
  data: {
    region:['北京市','北京市','东城区'],
    locationID:101010100,
    now:{
        temp:0,
        text:'未知',
        icon:'999',
        humidity:0,
        pressure:0,
        vis:0,
        windDir:0,
        windSpeed:0,
        windScale:0
    }
  },
//更新地区信息
changeRegion: function(e){
    //console.log(e.detail.value)
    this.setData({region: e.detail.value});
    this.getlocationID().then(result => {
        this.getWeather();
    })
},

/*获取天气*/
getWeather: function(){
    var that = this;//this不能被直接修改，var全局
    wx.request({
      url: 'https://pa2tunh8un.re.qweatherapi.com/v7/weather/now?',
      data:{
          location: that.data.locationID,
          key:'c787a274e3994da58d8d1c89413d675a'
      },
      success:function(res){
          console.log(res.data);
          that.setData({now: res.data.now})
      }
    })
},
getlocationID: function(){
    var that = this;
    return new Promise(resolve => {
      wx.request({
        url: 'https://pa2tunh8un.re.qweatherapi.com/geo/v2/city/lookup?',
        data:{
            location:that.data.region[1],
            adm:that.data.region[0],
            key:'c787a274e3994da58d8d1c89413d675a'
        },
        success: res => {
            console.log(res.data);
            that.setData({locationID:res.data.location[0].id})
            return resolve();
        },
      })
    });
},
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.getlocationID().then(result => {
        this.getWeather();
    })
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */


  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})