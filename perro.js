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
      for (var j = 0; j < node[i].data.length; j++) {
        var data_date = new Date(node[i].data[j].date);
        if (data_date < min_date) {
          min_date = data_date;
        }
        if (data_date > max_date) {
          max_date = data_date;
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
  var start = min_date;
  start.setDate(min_date.getDate() - min_date.getDay());
  var end = max_date;
  end.setDate(end.getDate() + (7 - end.getDay()));

  // Generate the date range in 1w increments.
  var date_range = [];
  while (start <= end) {
    date_range.push(new Date(start));
    start.setDate(start.getDate() + 7);
  }

  return date_range;
};

var visitNodes = function(node, start, end, cb) {
  for (var i = 0; i < node.length; i++) {

    // Traverse this node's data.
    if (node[i].data) {
      for (var j = 0; j < node[i].data.length; j++) {
        var data_date = new Date(node[i].data[j].date);
        if (data_date >= start && data_date < end) {
          cb(node[i].data[j]);
        }
      }
    }

    // Traverse this node's children.
    if (node[i].nodes) {
      visitNodes(node[i].nodes, start, end, cb);
    }
  }
};

var getTrackingSeries = function(node) {
  var min_max_dates = getMinMaxDates(node);
  if (min_max_dates.max < new Date()) {
    min_max_dates.max = new Date();
  }
  var date_range = getDateRange(min_max_dates.min, min_max_dates.max);

  var progress = Array(date_range.length);
  var remaining = Array(date_range.length);
  var total = Array(date_range.length);

  // Walk the node in time order.
  var t;
  for (t = 0; t < date_range.length - 1; t++) {
    var start = date_range[t];
    var end = date_range[t+1];

    // progress and remaining carry forward from previous interval.
    if (t === 0) {
      progress[t] = 0;
      remaining[t] = 0;
    } else {
      progress[t] = progress[t-1];
      remaining[t] = remaining[t-1];
    }

    visitNodes(node, start, end, function(data) {
      progress[t] += data.progress;
      remaining[t] = data.remaining;
    });

    total[t] = progress[t] + remaining[t];
  }

  // zip the result into a timeseries.
  var progress_series = [];
  var remaining_series = [];
  var total_series = [];

  for (t = 0; t < date_range.length - 1; t++) {
    progress_series.push([date_range[t].getTime(), progress[t]]);
    remaining_series.push([date_range[t].getTime(), remaining[t]]);
    total_series.push([date_range[t].getTime(), total[t]]);
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
  .state('project.insert', {
    url: '/insert',
    views: {
      'area': {
        templateUrl: 'insert.html',
        controller: 'InsertController'
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

  $scope.newSubItem = function (scope) {
    var nodeData = scope.$modelValue;
    nodeData.nodes.push({
      id: nodeData.id * 10 + nodeData.nodes.length,
      title: nodeData.title + '.' + (nodeData.nodes.length + 1),
      nodes: []
    });
  };

  $scope.selectNode = function(id) {
    $state.go('project.insert', {'id': id});
  };

});

MyApp.controller('InsertController', function($scope, $state) {

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

    if ($scope.$parent.node.data === undefined) {
      $scope.$parent.node.data = [];
    }

    $scope.$parent.node.data.push({
      date: $scope.date,
      username: $scope.username,
      progress: $scope.progress,
      remaining: $scope.remaining
    });
  };

  $scope.removeData = function(date, username) {
    var result = confirm('Are you sure? There is no undo.');
    if (!result) {
      return;
    }
    for (var i in $scope.$parent.node.data) {
      if ($scope.$parent.node.data[i].date === date &&
          $scope.$parent.node.data[i].username === username) {
        $scope.$parent.node.data.splice(i, 1);
        return;
      }
    }
  };
});

MyApp.controller('TrackingController', function($scope, $state) {
  $scope.dates = getMinMaxDates([$scope.$parent.node]);
  /*
  $scope.series = [
    {
      data: [
        [(new Date("2010/01/01")).getTime(), 1],
        [(new Date("2010/01/02")).getTime(), 2],
        [(new Date("2010/01/03")).getTime(), 3],
      ],
      name: 'foo'
    }
  ];*/

  $scope.series = getTrackingSeries([$scope.$parent.node]);

  $scope.chart_config = {
    options: {
      //This is the Main Highcharts chart config. Any Highchart options are valid here.
      //will be overriden by values specified below.
      chart: {
        
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
