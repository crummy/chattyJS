;(function (Reply, Post) {
    'use strict';
    var WinChatty = function(args) {
        this.args = args || [];
    };
    $.extend(WinChatty.prototype, {
        load: function(args, cb) {
            var postArgs = {}, successCb = cb, loadRef = this;
            for (var i = 0; i < this.args.length; i++) {
                postArgs['arg' + i] = this.args[i];
            }
            $.post(window.location.protocol + '//winchatty.com/service/json', postArgs,
                function (data) {
                    loadRef.success(data);
                    if (successCb) {
                        successCb();
                    }
                },
            'json').fail(this.failure);
        },
        success: function(obj) {
            if (obj.hasOwnProperty('faultString')) {
                console.error('Server fault occurred: ' + obj.faultString);
                return false;
            }
            return true;
        },
        failure: function (jqXHR, statusText, errorThrown) {
            var errorList = [['POST failed due to: '], ['Error:', ['[', jqXHR.status, ']: ', statusText], ['Response:', errorThrown]]];

            console.error(errorList.join(' '));
            return false;
        }
    });

    var WinChattyThread = function () {
        this.args = ["ChattyService.getThreadTree"];
    };
    WinChattyThread.prototype = new WinChatty();
    $.extend(WinChattyThread.prototype, {
        threadSuccess: function (tree) {
            // http://programmers.stackexchange.com/questions/214227/
            var stack = [], replies = [], root = new Reply();

            if (!WinChattyThread.prototype.success(tree)) { // Cuz 'this' references jQuery, not WinChattyThread
                return false;
            }

            $.extend(root, tree.replies[0]);
            stack.push(root);
            for (var i = 1; i < tree.replies.length; i++) { // start at i=1 deliberately to skip root, handled above
                var reply = new Reply(),
                    delta = tree.replies[i].depth - stack.length;
                $.extend(reply, tree.replies[i]);
                if (delta > 0) {
                    stack.push(stack.front().children.front());
                }
                while (delta < 0) {
                    stack.pop();
                    delta++;
                }
                stack.front().children.push(reply); // build the tree
                replies.push(reply); // build the list
            }

            Post.prototype.selectedPost.setAttribute('replyList', replies);
            Post.prototype.selectedPost.setAttribute('replyTree', root);
        }
    });

    var WinChattyStories = function (data) {
        this.args  = ["ChattyService.getStories"];
        this.title = data[0].title;
        this.story_id = data[0].story_id;
        this.stories = {};
    };
    WinChattyStories.prototype = new WinChatty();
    $.extend(WinChattyStories.prototype, {
        storiesLoad: function (args, cb) {
            WinChattyStories.prototype.load(args, cb);
        },
        storiesSuccess: function (data) {
            var title = data[0].title,
                story_id = data[0].story_id,
                winchatStory = new WinChattyStory();
                function (story) {
                    var posts = getThreads(story);
                    $('#title').text(title + ": " + story.story_name);
                    window.setInterval(function () {
                        postCalculationLoop(posts);
                    }, framerate);
                }
        },
        failure: function (error) {
            window.alert("Failed to access winchatty database: " + error);
        }
    });

    var WinChattyStory = function (story_id) {
        this.args = ["ChattyService.getStory", story_id, 1];
    };
    WinChattyStory.prototype =  $.extend(new WinChatty(), {
    });

    this.WinChattyThread  = WinChattyThread;
    this.WinChattyStories = WinChattyStories;
    this.WinChattyStory   = WinChattyStory;

}).call(window, window.Reply, window.Post);