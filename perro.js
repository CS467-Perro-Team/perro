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

var MyApp = angular.module('MyApp', ['ui.router', 'ui.tree']);

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
