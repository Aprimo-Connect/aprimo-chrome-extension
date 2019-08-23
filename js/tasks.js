// Holds values pulled from chrome storage.
var url;
var clientId;
var loginId;
var userToken;

/*** Task Inbox Functionality ****/
// Holds the raw taskJSON back from the REST API.
var taskJSON;
// Holds the raw reviewTaskJSON back from the REST API.
var reviewTaskJSON;
// Consolidates and sorts the tasks and review tasks.
var consolidatedTaskList = [];
// Holds the project JSON back from the REST API
var projectJSON;
// Holds the activity JSON back from the REST API
var activityJSON;

// Set up the logout button. When it's clicked, we simply clear values from chrome storage and bump them back to the login page.
var logoutBtn = document.getElementById("logoutBtn");
logoutBtn.addEventListener("click", function() {
    chrome.storage.sync.set({ apr_loginId : '', apr_userToken : '', apr_url: '', apr_clientId : '', apr_isLoggedIn : false }, function() {
        window.location = "login.html";
    });
    return false;
});


// Grab variables from Chrome storage. If the user is logged in, move forward with showing their tasks.
chrome.storage.sync.get(["apr_isLoggedIn","apr_clientId","apr_loginId","apr_url","apr_userToken"], function(items){
    if (items.apr_isLoggedIn == true)
    {
        url = items.apr_url;
        clientId = items.apr_clientId;
        loginId = items.apr_loginId;
        userToken = items.apr_userToken;
        GetAccessToken();
    }
    else
        window.location = "login.html";
});

// Attempt to get their access token from Aprimo. 
// If this fails, we clear chrome storage and bump the user back to the login screen.
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
            if (xhr.status == 200)
            {
                at = JSON.parse(xhr.responseText);
                log("Got access token " + at);
                GetTasks();
            }
            else
            {
                chrome.storage.sync.set({ apr_loginId : '', apr_userToken : '', apr_url: '', apr_clientId : '', apr_isLoggedIn : false }, function() {
                    window.location = "login.html";
                });
            }
            
        
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
        ConsolidateTasks();
        }
    }
    xhr.send(postBody);
}

// Now that we have both regular and review tasks, consolidate them into the same list and sort by due date.
function ConsolidateTasks()
{

    for (var i = 0; i < taskJSON._embedded.Task.length; i++ )
    {
        consolidatedTaskList.push({
            taskId : taskJSON._embedded.Task[i].taskId,
            name : taskJSON._embedded.Task[i].name,
            projectId:taskJSON._embedded.Task[i].projectId,
            status : (taskJSON._embedded.Task[i].workFlowTaskStatus == 4 ? "Assigned" : "In Process") ,
            dueDate : (taskJSON._embedded.Task[i].endDate.split('T')[0]),
            type : "task"
        });
    }

    for (var i = 0; i < reviewTaskJSON._embedded.ReviewTask.length; i++ )
    {
        consolidatedTaskList.push({
            taskId : reviewTaskJSON._embedded.ReviewTask[i].taskId,
            name : reviewTaskJSON._embedded.ReviewTask[i].name,
            projectId : reviewTaskJSON._embedded.ReviewTask[i].projectId,
            status : (reviewTaskJSON._embedded.ReviewTask[i].workFlowTaskStatus == 4 ? "Assigned" : "In Process") ,
            dueDate : (reviewTaskJSON._embedded.ReviewTask[i].endDate.split('T')[0]),
            type : "review-task"
        });
    }

    log(consolidatedTaskList);

    // If we have no tasks, no need to get the projects and activities.
    if (consolidatedTaskList.length == 0)
        RenderTasks();
    else
        GetProjects();
}


function GetProjects()
{
    // Get the unique list of projects.
    var projectIds = consolidatedTaskList.map(item => item.projectId).filter((value, index, self) => self.indexOf(value) === index);

    log(projectIds)

    let xhr = new XMLHttpRequest();
    xhr.open("POST", url + "api/projects/search", true);
    xhr.setRequestHeader("X-Access-Token", at.accessToken);
    xhr.setRequestHeader("Content-Type", 'application/json');

    var postBody = `
    {
        "or": [
    `

    for (i = 0; i < projectIds.length; i++)
    {
        postBody+= `

        { 
            "equals" :
            {
                "fieldName" : "projectId",
                "fieldValue" : ` + projectIds[i] + `
            }
        },
        `
    }

    // Crop off the last extra comma
    postBody = postBody.substring(0,postBody.length-1);

    postBody +=
        `]
        }
        `;

    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
        projectJSON = JSON.parse(xhr.responseText);
        GetActivities();
        }
    }
    xhr.send(postBody);
}



function GetActivities()
{
    // Get the unique list of activities.
    var activityIds = projectJSON._embedded.Project.map(item => item.activityId).filter((value, index, self) => self.indexOf(value) === index);

    log(activityIds);

    let xhr = new XMLHttpRequest();
    xhr.open("POST", url + "api/activities/search", true);
    xhr.setRequestHeader("X-Access-Token", at.accessToken);
    xhr.setRequestHeader("Content-Type", 'application/json');

    var postBody = `
    {
        "or": [
    `

    for (i = 0; i < activityIds.length; i++)
    {
        postBody+= `

        { 
            "equals" :
            {
                "fieldName" : "activityId",
                "fieldValue" : ` + activityIds[i] + `
            }
        },
        `
    }

    // Crop off the last extra comma
    postBody = postBody.substring(0,postBody.length-1);

    postBody +=
        `]
        }
        `;

    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            
        activityJSON = JSON.parse(xhr.responseText);
        log(activityJSON)
        RenderTasks();
        }
    }
    xhr.send(postBody);
}


function RenderTasks()
{
    var totalTasks = taskJSON._total + reviewTaskJSON._total;
    chrome.browserAction.setBadgeText({"text": totalTasks.toString()});
    taskCountSpan = document.getElementById("taskCount");
    taskCountSpan.innerHTML = totalTasks;

    // Arrange by soonest due first.
    consolidatedTaskList.sort((a,b) => a.dueDate > b.dueDate ? 1 : -1);

    log(consolidatedTaskList);
    //let contentArea = document.getElementById('contentArea');
    let taskList = document.getElementById('task-list');

    log(activityJSON);

    var loadingSpinner = document.getElementById("loadingSpinner");
    loadingSpinner.className+=" hidden";

    for (var i = 0; i < consolidatedTaskList.length; i++)
    {
        log(consolidatedTaskList[i].projectId)
        var project = projectJSON._embedded.Project.find(p => p.projectId == consolidatedTaskList[i].projectId);
        var activity = activityJSON._embedded.Activity.find(p => p.activityId == project.activityId);
        var taskCard = `
        <a id="` + consolidatedTaskList[i].taskId  + `" class="list-group-item hovernow" href="` + url + `MarketingOps/#/tasks-and-reviews/` + consolidatedTaskList[i].type + '/' + consolidatedTaskList[i].taskId + `" target="_blank">
          <div class="flex-justify-between">
            <div class="mb-1">
              <span class="text">Due ` + consolidatedTaskList[i].dueDate +`</span>
            </div>
            <span class="text-muted text-right">` + consolidatedTaskList[i].status + `</span>
          </div>
          <h4 class="mb-1 key-text">` + consolidatedTaskList[i].name + `</h4>
          <div class="flex-justify-between list-bottom">
            <div class="overflow-ellipsis column">
              <div class="text-muted">Project</div>
              <div class="overflow-ellipsis text detail">` + project.title + `</div>
            </div>
            <div class="overflow-ellipsis column">
              <div class="text-muted">Activity</div>
              <div class="overflow-ellipsis text detail">` + activity.name + `</div>
            </div>
          </div>
        </a>
        `;

        taskList.innerHTML += taskCard;

    }
}