// Only controls whether logging is enabled for the background script.
var consoleLog = false;

var url;
var clientId;
var loginId;
var userToken;

var taskJSON;
var reviewTaskJSON;

function log(msg)
{
  if (consoleLog)
    console.log(msg);
}

// Set up an alarm to check for new tasks periodically.
// Do NOT drop below 10 minutes to avoid eating through API limits.
chrome.runtime.onInstalled.addListener(function() {
  chrome.alarms.create("apr_taskCheck", {delayInMinutes: 1, periodInMinutes: 10} );
  log("Alarm has been set up.")
});

// This function will fire when an alarm is triggerd.
chrome.alarms.onAlarm.addListener(function( alarm ) {
  log("Alarm has been triggered.")
  chrome.storage.sync.get(["apr_isLoggedIn","apr_clientId","apr_loginId","apr_url","apr_userToken"], function(items){
    if (items.apr_isLoggedIn == true)
    {
        url = items.apr_url;
        clientId = items.apr_clientId;
        loginId = items.apr_loginId;
        userToken = items.apr_userToken;
        updateBadge();
    }
    else
    {
        chrome.browserAction.setBadgeText({"text": ''});
    }
});
});


function updateBadge()
{
    log("Aprimo Extension: Updating Badge.")

    GetAccessToken();
    var now = new Date();
    chrome.storage.local.set({ apr_LastTaskCheck : now.toString() }, function() {
        log('Value is set to ' + now.toString());
      });
     
}

function GetAccessToken()
{
    var base64auth = btoa(unescape(encodeURIComponent(loginId + ':' + userToken)));
    let xhr = new XMLHttpRequest();
    xhr.open("POST", url + "api/oauth/create-native-token", true);
    xhr.setRequestHeader("client-id", clientId);
    xhr.setRequestHeader("content-type", "application/json");
    xhr.setRequestHeader("Authorization","Basic " + base64auth) 
    xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
        at = JSON.parse(xhr.responseText);
        GetTasks();
        }
    }
    xhr.send();
}

function GetTasks()
{
    log("Getting Tasks");
    let xhr = new XMLHttpRequest();
    xhr.open("POST", url + "api/tasks/search", true);
    xhr.setRequestHeader("X-Access-Token", at.accessToken);
    xhr.setRequestHeader("Content-Type", 'application/json');

    var postBody =
        `
        {
            "or": [
                { 
                    "equals" :
                    {
                        "fieldName" : "workFlowTaskStatus",
                        "fieldValue" : 4
                    }
                },
                { 
                    "equals" :
                    {
                        "fieldName" : "workFlowTaskStatus",
                        "fieldValue" : 5
                    }
                }
            ]
        }
        `;

    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            let resp = JSON.parse(xhr.responseText);
            log("Got tasks " + resp);
            taskJSON = resp;
            GetReviewTasks();
        }
    }
    xhr.send(postBody);
    
}

function GetReviewTasks()
{
    let xhr = new XMLHttpRequest();
    xhr.open("POST", url + "api/review-tasks/search", true);
    xhr.setRequestHeader("X-Access-Token", at.accessToken);
    xhr.setRequestHeader("Content-Type", 'application/json');

    var postBody =
        `
        {
            "or": [
                { 
                    "equals" :
                    {
                        "fieldName" : "workFlowTaskStatus",
                        "fieldValue" : 4
                    }
                },
                { 
                    "equals" :
                    {
                        "fieldName" : "workFlowTaskStatus",
                        "fieldValue" : 5
                    }
                }
            ]
        }
        `;

    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
        let resp = JSON.parse(xhr.responseText);
        log(resp);
        reviewTaskJSON = resp;
        SetBadge();
        }
    }
    xhr.send(postBody);
}

function SetBadge()
{
    var totalTasks = taskJSON._total + reviewTaskJSON._total;
    chrome.browserAction.setBadgeText({"text": totalTasks.toString()});
}
