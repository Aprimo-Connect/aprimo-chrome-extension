chrome.browserAction.setBadgeText({"text": ''});
var loginBtn = document.getElementById("loginBtn");

var clientIdbox = document.getElementById("clientId");
var loginIdbox = document.getElementById("loginId");
var userTokenbox = document.getElementById("userToken");
var urlbox = document.getElementById("url");


chrome.storage.sync.get(["clientIdbox","loginIdbox","userTokenbox","urlbox"], function(items)
{
    if (items.clientIdbox != undefined)
        clientIdbox.value = items.clientIdbox;
    if (items.loginIdbox != undefined)
        loginIdbox.value = items.loginIdbox;
    if (items.userTokenbox != undefined)
        userTokenbox.value = items.userTokenbox;
    if (items.urlbox != undefined)
        urlbox.value = items.urlbox;
})

clientIdbox.addEventListener("blur", function()
{
    chrome.storage.sync.set({ clientIdbox : clientIdbox.value }, function() {
    });
});

loginIdbox.addEventListener("blur", function()
{
    chrome.storage.sync.set({ loginIdbox : loginIdbox.value }, function() {
    });
});

userTokenbox.addEventListener("blur", function()
{
    chrome.storage.sync.set({ userTokenbox : userTokenbox.value }, function() {
    });
});

urlbox.addEventListener("blur", function()
{
    chrome.storage.sync.set({ urlbox : urlbox.value }, function() {
    });
});

chrome.storage.sync.get(["apr_isLoggedIn"], function(items){
    if (items.apr_isLoggedIn == true)
        window.location = "tasks.html"
});




loginBtn.addEventListener("click", function() {
    this.classList.add("hidden");
    var loadingSpinner = document.getElementById("loadingSpinner");
    loadingSpinner.classList.remove("hidden");
    errorMsg.innerHTML = "";
    var url = document.getElementById("url").value;
    if (url.substring(url.length-1,1) != "/")
        url+="/";
    url = url.replace("http://","https://");
    var clientId = document.getElementById("clientId").value;
    var loginId = document.getElementById("loginId").value;
    var userToken = document.getElementById("userToken").value;

    GetAccessToken(url,clientId,loginId,userToken);

    return false;
});

function GetAccessToken(url,clientId,loginId,userToken)
{
    var base64auth = btoa(unescape(encodeURIComponent(loginId + ':' + userToken)));
    let xhr = new XMLHttpRequest();
    xhr.open("POST", url + "api/oauth/create-native-token", true);
    xhr.setRequestHeader("client-id", clientId);
    xhr.setRequestHeader("content-type", "application/json");
    xhr.setRequestHeader("Authorization","Basic " + base64auth) 
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            
            if (xhr.status == 200)
            {
                at = JSON.parse(xhr.responseText);
                chrome.storage.sync.set({ apr_loginId : loginId, apr_userToken : userToken, apr_url: url, apr_clientId : clientId, apr_isLoggedIn : true }, function() {
                    window.location = "tasks.html";
                });
            }
            else 
            { 
                var loginBtn = document.getElementById("loginBtn");
                loginBtn.classList.remove("hidden");
                var loadingSpinner = document.getElementById("loadingSpinner");
                loadingSpinner.classList.add("hidden");
                var loginBtn = document.getElementById("errorMsg");
                errorMsg.innerHTML = "An error occured while logging in. Please check your entered values and try again."

            }
        }
    }
    xhr.send();
}