var util = require('util');
var request = require('request');
var asana_key = process.env.ASANA_KEY
var asana_base_url = 'https://app.asana.com/api/1.0';
// If there are no users, it crashes
var users = JSON.parse(process.env.ASANA_USERS);

function getCommit(req) {
  var payload;
  if (typeof req.body.payload === 'object') {
      payload = req.body.payload;
  } else {
      payload = JSON.parse(req.body.payload);
  }

  // Most recent commit is last in commits
  return payload.commits[payload.commits.length - 1];
}

function getTaskActions(commit) {
  var tasks = [];
  var msg = commit.message;
  console.log("Message: ");
  console.log(msg);
  var task_regex = /&(\d+)/g;
  var proj_regex = /\%(\d+)/g;
  var task_id = task_regex.exec(msg)[1];
  var proj_id = proj_regex.exec(msg)[1];

  tasks.push({
    author: commit.author.username,
    task: task_id,
    project: proj_id,
    commit_str: commit.id.slice(0,7),
    commit_msg: commit.message
  });

  return tasks;
}

function sendTaskCommentsToAsana(tasks) {
    // change asana user depending on the commit
  var auths = {};
  for (var i = 0; i < users.length; i++) {
    auths[users[i].username] = 'Basic ' + new Buffer(users[i].key + ":").toString('base64');
  }
  var defaultAuth = 'Basic ' + new Buffer(asana_key+":").toString('base64');
  
  for (var i in tasks) {
    var task = tasks[i];
    var auth;
    if (auths[task.author])
    {
      auth = auths[task.author];
    }
    else
    {
      auth = defaultAuth;
    }
    console.log("Task ID: "+task.task);
    console.log("Project ID: "+task.project);

    request.post({
        url: asana_base_url+"/tasks/"+task.task+"/addProject/", 
        json: {data: {project:task.project}},
        headers: {"Authorization":auth}
      }, apiCallback);
  }
}

function apiCallback (error, response, body) {
    if (!error && response.statusCode == 200) {
        console.log(body)
    } else {
        console.log(response.statusCode+': '+error);
        console.log(util.inspect(response.body));
    }
}

exports.index = function(req, res){
  var commit = getCommit(req);
  var actions = getTaskActions(commit);
  sendTaskCommentsToAsana(actions);
  console.log("Updated Asana.");
};
