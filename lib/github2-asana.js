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
  // If isn't master, we gonna not do nuthin'
  var name_regex = /master/g;
  if (undefined != name_regex.exec(payload.ref)) {
    return payload.commits[payload.commits.length - 1];
  } else {
    return null;
  }
}

function getTaskActions(commit) {
  var tasks = [];
  var msg = commit.message;
  //Just split on the slash, man
  var task_regex = /(app\.asana\.com\/\d+\/\d+\/)(\d+)/g;
  var match = task_regex.exec(msg);
  console.log("Match: "+match);
  var task_id = match[2];

  tasks.push({
    author: commit.author.username,
    task: task_id,
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

    //Grab all projects
    request.get({
         url: asana_base_url+"/projects", 
         json: {data: {archived:false}},
         headers: {"Authorization":auth}
       }, function (error, response, body) {

           var projectID;
           var data = body.data;
           for (i in data) {
             var name = data[i].name;
             // Only want the current On Stage project
             var name_regex = /On Stage/g;
             if (undefined != name_regex.exec(name)){
               projectID = data[i].id;
             }
           } 
           
           // Add to that project
           request.post({
               url: asana_base_url+"/tasks/"+task.task+"/addProject/", 
               json: {data: {project:projectID}},
               headers: {"Authorization":auth}
             }, apiCallback);

           var comment_text = "[MERGEBOT] "+task.author+" merged "+task.commit_msg;

           // Post a comment on that project
           request.post({
               url: asana_base_url+"/tasks/"+task.task+"/stories", 
               json: {data: {text:comment_text}},
               headers: {"Authorization":auth}
             }, apiCallback);
       });

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
  if (null !== commit) {
      var actions = getTaskActions(commit);
      sendTaskCommentsToAsana(actions);
      console.log("Updated Asana.");
  } else { 
     console.log("Skipping commit, not master.");
  }
};
