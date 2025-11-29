const s = document.createElement("script");
s.src = chrome.runtime.getURL("page.js");
document.documentElement.appendChild(s);
s.remove();
