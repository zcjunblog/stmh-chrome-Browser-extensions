// chrome.browserAction.setBadgeText({text: '2020'});
// chrome.browserAction.setBadgeBackgroundColor({color: [255, 0, 0, 255]});
chrome.contextMenus.create({
	title: "解析当前影视地址~",
	onclick: function(){
		chrome.tabs.getSelected(null, function (tab) {
			 var myUrl = 'http://v.xssv.cn/?v='+tab.url
			 window.open(myUrl,'_blank')
	 });
  }
});
chrome.contextMenus.create({
	title: "听会歌，放松一下~",
	onclick: function(){
    chrome.tabs.create({url: './mc.html'});
  }
})
chrome.contextMenus.create({
	title: "4K壁纸，轻松获取~",
	onclick: function(){
    chrome.tabs.create({url: './pic.html'});
  }
})
chrome.contextMenus.create({
	title: "导航网站，应有尽有~",
	onclick: function(){
		chrome.tabs.create({url: './game.html'});
	}
})
