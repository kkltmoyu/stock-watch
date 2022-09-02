const vscode = require('vscode');
const axios = require('axios');
// const baseUrl = 'https://api.money.126.net/data/feed/';
const baseUrl = 'http://qt.gtimg.cn/q=';

let statusBarItems = {};
let stockCodes = [];
let updateInterval = 10000;
let timer = null;
let showTimer = null;
const config = vscode.workspace.getConfiguration();
const names = config.get('stock-watch.stocksName');

function activate(context) {
	init();
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(handleConfigChange)
	);
}
exports.activate = activate;

function deactivate() {}
exports.deactivate = deactivate;

function init() {
	initShowTimeChecker();
	if (isShowTime()) {
		stockCodes = getStockCodes();
		updateInterval = getUpdateInterval();
		fetchAllData();
		timer = setInterval(fetchAllData, updateInterval);
	} else {
		hideAllStatusBar();
	}
}

function initShowTimeChecker() {
	showTimer && clearInterval(showTimer);
	showTimer = setInterval(() => {
		if (isShowTime()) {
			init();
		} else {
			timer && clearInterval(timer);
			hideAllStatusBar();
		}
	}, 1000 * 60 * 10);
}

function hideAllStatusBar() {
	Object.keys(statusBarItems).forEach((item) => {
		statusBarItems[item].hide();
		statusBarItems[item].dispose();
	});
}

function handleConfigChange() {
	timer && clearInterval(timer);
	showTimer && clearInterval(showTimer);
	const codes = getStockCodes();
	Object.keys(statusBarItems).forEach((item) => {
		if (codes.indexOf(item) === -1) {
			statusBarItems[item].hide();
			statusBarItems[item].dispose();
			delete statusBarItems[item];
		}
	});
	init();
}

function getStockCodes() {
	const config = vscode.workspace.getConfiguration();
	const stocks = config.get('stock-watch.stocks');
	return stocks.map((code) => {
		if (isNaN(code[0])) {
			if (code.toLowerCase().indexOf('us_') > -1) {
				return code.toUpperCase();
			} else if (code.indexOf('hk') > -1) {
				return code;
			} else {
				return code.toLowerCase().replace('SZ', 'sz').replace('SH', 'sh');
			}
		} else {
			return (code[0] === '6' ? '0' : '1') + code;
		}
	});
}

function getUpdateInterval() {
	const config = vscode.workspace.getConfiguration();
	return config.get('stock-watch.updateInterval');
}

function isShowTime() {
	const config = vscode.workspace.getConfiguration();
	const configShowTime = config.get('stock-watch.showTime');
	let showTime = [0, 23];
	if (
		Array.isArray(configShowTime) &&
		configShowTime.length === 2 &&
		configShowTime[0] <= configShowTime[1]
	) {
		showTime = configShowTime;
	}
	const now = new Date().getHours();
	return now >= showTime[0] && now <= showTime[1];
}

function getItemText(item) {
	return `「${item.name}」${keepDecimal(item.price, calcFixedNumber(item))} ${
		item.percent >= 0 ? '📈' : '📉'
	} ${keepDecimal(item.percent, 2)}%`;
}

function getTooltipText(item) {
	return `${item.type}${item.symbol}\n涨跌：${
		item.updown
	}   百分：${keepDecimal(item.percent * 100, 2)}%\n最高：${
		item.high
	}   最低：${item.low}\n今开：${item.open}   昨收：${item.yestclose}`;
}

function getXQItemText(item) {
	return `「${item.name}」${keepDecimal(item.current, calcXQFixedNumber(item))} ${
		item.percent >= 0 ? '📈' : '📉'
	} ${keepDecimal(item.percent, 2)}%`;
}

function getXQTooltipText(item) {
	return `【今日】${item.symbol}\n涨跌：${
		item.chg
	}   百分：${keepDecimal(item.percent, 2)}%\n最高：${
		item.high
	}   最低：${item.low}\n今开：${item.open}   昨收：${item.last_close}`;
}

function getItemColor(item) {
	const config = vscode.workspace.getConfiguration();
	const riseColor = config.get('stock-watch.riseColor');
	const fallColor = config.get('stock-watch.fallColor');

	return item.percent >= 0 ? riseColor : fallColor;
}
function fetchAllData() {
	let that = this;
	const config = {
		timeout: 15000,
		headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json;charset=utf-8',
			// 'Connection':'keep-alive'
		},
		url: `${baseUrl}${stockCodes.join(',')}`,
		method: 'GET',
		transformResponse: [
			function (data) {
				console.log('global is ', global)
				return global.decodeURI(data)
				// let FileReader = global.window.FileReader;
				// let reader = new FileReader();
				// reader.readAsText(data, 'GBK');
				// reader.onload = function (e) {
				// 	let obj = JSON.parse(reader.result);
				// 	that.data = obj
				// }
				// return data;

			}
		]
		
		// withCredentials: false,
	}

	axios
		.request({
			...config
		})
		
		.then(
			(res) => {
				try {
					let result = res.data.split(';');
					result = result.splice(0,result.length - 1)
					let data = [];
					result.map((item, index) => {
						let arr = item.split('"');
						let target = arr[1].split('~');
						let obj = {
							symbol: stockCodes[index],
							name: names[index],
							high: target[33],
							low: target[34],
							open: target[5],
							yestclose: target[4],
							last_close: target[4],
							updown: target[31],
							chg: target[31],
							percent: target[32],
							current: target[3],
							price: target[3]
						} 
						data.push(obj);
					})
					// Object.keys(result).map((item,index) => {
					// 	if (!result[item].symbol) {
					// 		result[item].symbol = item;
					// 	}
					// 	data.push(result[item]);
					// });
					displayXQData(data);

				} catch (error) {}
			},
			(error) => {
				console.error(error);
			}
		)
		.catch((error) => {
			console.error(error);
		});
}

function displayData(data) {
	data.map((item) => {
		const key = item.code;
		if (statusBarItems[key]) {
			statusBarItems[key].text = getItemText(item);
			statusBarItems[key].color = getItemColor(item);
			statusBarItems[key].tooltip = getTooltipText(item);
		} else {
			statusBarItems[key] = createStatusBarItem(item);
		}
	});
}

function displayXQData(data) {
	 data.map((item) => {
	 	const key = item.symbol;
	 	if (statusBarItems[key]) {
	 		statusBarItems[key].text = getXQItemText(item);
	 		statusBarItems[key].color = getItemColor(item);
	 		statusBarItems[key].tooltip = getXQTooltipText(item);
	 	} else {
	 		statusBarItems[key] = createXQStatusBarItem(item);
	 	}
	 });
 }

function createStatusBarItem(item) {
	const barItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left,
		0 - stockCodes.indexOf(item.code)
	);
	barItem.text = getItemText(item);
	barItem.color = getItemColor(item);
	barItem.tooltip = getTooltipText(item);
	barItem.show();
	return barItem;
}

function createXQStatusBarItem(item) {
	const barItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left,
		0 - stockCodes.indexOf(item.symbol)
	);
	barItem.text = getXQItemText(item);
	barItem.color = getItemColor(item);
	barItem.tooltip = getXQTooltipText(item);
	barItem.show();
	return barItem;
}

function keepDecimal(num, fixed) {
	var result = parseFloat(num);
	if (isNaN(result)) {
		return '--';
	}
	return result.toFixed(fixed);
}

function calcFixedNumber(item) {
	var high =
		String(item.high).indexOf('.') === -1
			? 0
			: String(item.high).length - String(item.high).indexOf('.') - 1;
	var low =
		String(item.low).indexOf('.') === -1
			? 0
			: String(item.low).length - String(item.low).indexOf('.') - 1;
	var open =
		String(item.open).indexOf('.') === -1
			? 0
			: String(item.open).length - String(item.open).indexOf('.') - 1;
	var yest =
		String(item.yestclose).indexOf('.') === -1
			? 0
			: String(item.yestclose).length -
			  String(item.yestclose).indexOf('.') -
			  1;
	var updown =
		String(item.updown).indexOf('.') === -1
			? 0
			: String(item.updown).length - String(item.updown).indexOf('.') - 1;
	var max = Math.max(high, low, open, yest, updown);

	if (max === 0) {
		max = 2;
	}

	return max;
}

function calcXQFixedNumber(item) {
	var high =
		String(item.high).indexOf('.') === -1 ?
		0 :
		String(item.high).length - String(item.high).indexOf('.') - 1;
	var low =
		String(item.low).indexOf('.') === -1 ?
		0 :
		String(item.low).length - String(item.low).indexOf('.') - 1;
	var open =
		String(item.open).indexOf('.') === -1 ?
		0 :
		String(item.open).length - String(item.open).indexOf('.') - 1;
	var yest =
		String(item.last_close).indexOf('.') === -1 ?
		0 :
		String(item.last_close).length -
		String(item.last_close).indexOf('.') -
		1;
	var updown =
		String(item.chg).indexOf('.') === -1 ?
		0 :
		String(item.chg).length - String(item.chg).indexOf('.') - 1;
	var max = Math.max(high, low, open, yest, updown);

	if (max === 0) {
		max = 2;
	}

	return max;
}