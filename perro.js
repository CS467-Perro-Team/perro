/*
Copyright (c) 2016 Robert W. Rose
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
this list of conditions and the following disclaimer in the documentation and/or
other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
may be used to endorse or promote products derived from this software without
specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

var getNode = function(data, id) {
  for (var i = 0; i < data.length; i++) {
    if (data[i].id == id) {
      return data[i];
    }

    var node = getNode(data[i].nodes, id);
    if (node) {
      return node;
    }
  }

  return undefined;
};

var getMinMaxDates = function(node) {
  var min_date = new Date("2100/01/01");
  var max_date = new Date("1970/01/01");
  for (var i = 0; i < node.length; i++) {

    // Get minimum date for this node.
    if (node[i].data) {
      for (var username in node[i].data) {
        for (var date in node[i].data[username]) {
          var date_obj = new Date(date);
          if (date_obj < min_date) {
            min_date = date_obj;
          }
          if (date_obj > max_date) {
            max_date = date_obj;
          }
        }
      }
    }

    // Traverse children.
    if (node[i].nodes) {
      var child_dates = getMinMaxDates(node[i].nodes);
      if (child_dates.min < min_date) {
        min_date = child_dates.min;
      }
      if (child_dates.max > max_date) {
        max_date = child_dates.max;
      }
    }
  }

  return {
    min: min_date,
    max: max_date
  };
};

var getDateRange = function(min_date, max_date) {
  // Find the start and end in 1w offsets.
  var start = new Date(min_date);
  start.setDate(min_date.getDate() - min_date.getDay());
  var end = new Date(max_date);
  end.setDate(end.getDate() + (7 - end.getDay()));

  // Generate the date range in 1w increments.
  var date_range = [];
  while (start <= end) {
    date_range.push(new Date(start));
    start.setDate(start.getDate() + 7);
  }

  return date_range;
};

var getUsernames = function(node) {
  var usernames = {};
  for (var i = 0; i < node.length; i++) {
    for (var username in node[i].data) {
      usernames[username] = true;
    }

    var child_usernames = getUsernames(node[i].nodes);

    for (var child in child_usernames) {
      usernames[child] = true;
    }
  }

  return usernames;
};

var visitNodes = function(node, username, start, end, callback) {
  for (var i = 0; i < node.length; i++) {

    // Traverse this node's data.
    if (node[i].data) {
      for (var date in node[i].data[username]) {
        var date_obj = new Date(date);
        if (date_obj >= start && date_obj < end) {
          callback(node[i].data[username][date]);
        }
      }
    }

    // Traverse this node's children.
    if (node[i].nodes) {
      visitNodes(node[i].nodes, username, start, end, callback);
    }
  }
};

var getTrackingSeries = function(node) {
  var usernames = getUsernames(node);

  var min_max_dates = getMinMaxDates(node);
  if (min_max_dates.max < new Date()) {
    min_max_dates.max = new Date();
  }
  var date_range = getDateRange(min_max_dates.min, min_max_dates.max);

  var progress = {};
  var remaining = {};
  var total = {};
  var username, t;

  // Walk the nodes for each user.
  for (username in usernames) {
    progress[username] = Array(date_range.length);
    remaining[username] = Array(date_range.length);
    total[username] = Array(date_range.length);

    // Walk the nodes in time order.
    for (t = 0; t < date_range.length - 1; t++) {
      var start = date_range[t];
      var end = date_range[t+1];

      // progress and remaining carry forward from previous interval.
      if (t === 0) {
        progress[username][t] = 0;
        remaining[username][t] = 0;
      } else {
        progress[username][t] = progress[username][t-1];
        remaining[username][t] = remaining[username][t-1];
      }

      visitNodes(node, username, start, end, function(data) {
        progress[username][t] += data.progress;
        remaining[username][t] = data.remaining;
      });

      total[username][t] = progress[username][t] + remaining[username][t];
    }
  }

  // Sum all users for a total count per interval.
  progress_sum = Array(date_range.length);
  remaining_sum = Array(date_range.length);
  total_sum = Array(date_range.length);

  for (t = 0; t < date_range.length - 1; t++) {
    progress_sum[t] = 0;
    remaining_sum[t] = 0;
    total_sum[t] = 0;

    for (username in usernames) {
      progress_sum[t] += progress[username][t];
      remaining_sum[t] += remaining[username][t];
      total_sum[t] += total[username][t];
    }
  }
  
  // Zip the result into a timeseries.
  var progress_series = [];
  var remaining_series = [];
  var total_series = [];

  for (t = 0; t < date_range.length - 1; t++) {
    progress_series.push([date_range[t+1].getTime(), progress_sum[t]]);
    remaining_series.push([date_range[t+1].getTime(), remaining_sum[t]]);
    total_series.push([date_range[t+1].getTime(), total_sum[t]]);
  }

  return [
    {
      data: progress_series,
      name: 'Progress'
    },
    {
      data: remaining_series,
      name: 'Remaining'
    },
    {
      data: total_series,
      name: 'Total'
    }
  ];
};

var dateSort = function(a, b) {
  return new Date(a) - new Date(b);
};

var getSummaryTree = function(node) {
  var results = [];

  for (var i = 0; i < node.length; i++) {
    var result = {
      title: node[i].title,
      progress: 0,
      remaining: 0,
      total: 0,
      nodes: []
    };

    result.nodes = getSummaryTree(node[i].nodes);

    for (var n in result.nodes) {
      result.progress += result.nodes[n].progress;
      result.remaining += result.nodes[n].remaining;
    }

    var progress = {};
    var remaining = {};
    var total = {};

    // Summarize node by username.
    for (var username in node[i].data) {
      progress[username] = 0;
      remaining[username] = 0;

      // Retrieve date keys, sort chronologically.
      var dates = Object.keys(node[i].data[username]);
      dates.sort(dateSort);
      for (var date in dates) {
        // Add progress but take the last remaining as the value.
        progress[username] += node[i].data[username][dates[date]].progress;
        remaining[username] = node[i].data[username][dates[date]].remaining;
      }

      // Add per-user data.
      result.progress += progress[username];
      result.remaining += remaining[username];
    }

    // Determine sum total.
    result.total = result.progress + result.remaining;
    results.push(result);
  }

  return results;
};

var getSummaryTable = function(node) {
  var tree = getSummaryTree(node);

  var result = [];

  var getSummaryTableNode = function(node, i) {
    for (var n in node) {
      result.push({
        title: node[n].title,
        level: i,
        progress: node[n].progress,
        remaining: node[n].remaining,
        total: node[n].total
      });

      getSummaryTableNode(node[n].nodes, i+1);
    }
  };

  getSummaryTableNode(tree, 0);

  return result;
};

var MyApp = angular.module('MyApp', ['ui.router', 'ui.tree', 'highcharts-ng']);

MyApp.config(function($stateProvider, $urlRouterProvider) {
  $urlRouterProvider.otherwise("/");

  $stateProvider
  .state('project', {
    url: "/{id}",
    views: {
      'project': {
        templateUrl: "project.html",
        controller: 'ProjectController'
      },
    },
  })
  .state('project.summary', {
    url: '/summary',
    views: {
      'area': {
        templateUrl: 'summary.html',
        controller: 'SummaryController'
      }
    }
  })
  .state('project.data', {
    url: '/data',
    views: {
      'area': {
        templateUrl: 'data.html',
        controller: 'DataController'
      }
    }
  })
  .state('project.tracking', {
    url: '/tracking',
    views: {
      'area': {
        templateUrl: 'tracking.html',
        controller: 'TrackingController'
      }
    }
  });
});

MyApp.controller('ProjectController', function($scope, $state, $stateParams) {

  $scope.state = $state;

  var data = window.localStorage['project.data'];
  if (data === undefined) {
    $scope.data = [{
      'id': 1,
      'title': 'Project Root',
      'nodes': []
    }];
  } else {
    $scope.data = JSON.parse(data);
  }

  if ($stateParams.id) {
    $scope.id = $stateParams.id;
    $scope.node = getNode($scope.data, $stateParams.id);
  }

  $scope.$watch('data', function() {
    window.localStorage['project.data'] = JSON.stringify($scope.data);
  }, true);

  $scope.removeSubItem = function (item) {
    var result = confirm('Are you sure? There is no undo.');

    if (result) {
      item.remove();
    }
  };

  $scope.newSubItem = function (scope) {
    var nodeData = scope.$modelValue;
    nodeData.nodes.push({
      id: nodeData.id * 10 + nodeData.nodes.length,
      title: nodeData.title + '.' + (nodeData.nodes.length + 1),
      nodes: []
    });
  };

  $scope.selectNode = function(id) {
    $state.go($state.current.name, {'id': id});
  };

});

MyApp.controller('DataController', function($scope, $state) {

  $scope.addData = function() {
    if ($scope.$parent.node === undefined) {
      alert('Unexpected error');
      return;
    }

    if ($scope.date === null) {
      alert('Invalid date');
      return;
    }
    if ($scope.progress === null || $scope.progress < 0) {
      alert('Progress must be >= 0');
      return;
    }
    if ($scope.remaining === null || $scope.remaining < 0) {
      alert('Remaining must be >= 0');
      return;
    }
    if ($scope.username === undefined) {
      $scope.username = 'null';
    }

    if ($scope.$parent.node.data === undefined) {
      $scope.$parent.node.data = {};
    }

    if ($scope.$parent.node.data[$scope.username] === undefined) {
      $scope.$parent.node.data[$scope.username] = {};
    }

    $scope.$parent.node.data[$scope.username][$scope.date] = {
      progress: $scope.progress,
      remaining: $scope.remaining
    };
  };

  $scope.removeData = function(date, username) {
    var result = confirm('Are you sure? There is no undo.');
    if (!result) {
      return;
    }

    // Remove the data at this location.
    delete $scope.$parent.node.data[username][date];

    // Remove the username if this was the last data point for it.
    if (Object.keys($scope.$parent.node.data[username]).length === 0) {
      delete $scope.$parent.node.data[username];
    }
  };
});

MyApp.controller('TrackingController', function($scope, $state) {
  $scope.series = getTrackingSeries([$scope.$parent.node]);

  $scope.chart_config = {
    options: {
      //This is the Main Highcharts chart config. Any Highchart options are valid here.
      //will be overriden by values specified below.
      chart: {
        zoomType: 'x'
      },
      xAxis: {
        type: 'datetime'
      },
    },
    title: {
      text: $scope.$parent.node.title
    },
    series: $scope.series,
  };
});

MyApp.controller('SummaryController', function($scope, $state) {
  $scope.summary = getSummaryTable([$scope.$parent.node]);
});
