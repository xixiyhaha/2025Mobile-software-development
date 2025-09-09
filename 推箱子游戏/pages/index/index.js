// pages/index/index.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    levels:[
      'level01.png',
      'level02.png',
      'level03.png',
      'level04.png'
    ]
  },
  // 自定义函数--游戏选关
  chooseLevel:function(e){
    let level = e.currentTarget.dataset.level
    wx.navigateTo({
      url:'../game/game?level=' + level
    })
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {

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
  onUnload() {

  },

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