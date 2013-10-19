$(function () {
    var framerate = 1000 / 30;

    // Simple little Vector2 class for physics calculations
    function Vector2(x, y) {
        this.x = x;
        this.y = y;
    }
    // Additional functionality to Array, used if you want to treat it like a stack.
    // Returns the last .push()'d entry... well technically just the last entry which hopefully is the last pushed.
    Array.prototype.front = function () {
        return this[this.length - 1];
    };
    // Simple assert function to double check my work when parsing replies.
    // Thanks http://stackoverflow.com/questions/15313418/javascript-assert
    function assert(condition, message) {
        if (!condition) {
            throw message || "Assertion failed";
        }
    }

    // Applies a force-based calculation to every post.
    // mostly thanks to http://blog.ivank.net/force-based-graph-drawing-in-as3.html
    function postCalculationLoop(posts) {
        posts.forEach(function (postA) {
            var netVelocity = new Vector2(0, 0);
            posts.forEach(function(postB) {
                if (postA === postB) {
                    return; // no need to compare a node to itself
                }
                var repulsion = new Vector2(0, 0),
                    attraction = new Vector2(0, 0),
                    gravity = applyGravity.call(postA, postB);
                if (postA.category === postB.category) {
                    attraction = attractTo.call(postA, postB);
                }
                if (!postA.isSelected()) {
                    repulsion = repulseFrom.call(postA, postB);
                }
                netVelocity.x += repulsion.x + attraction.x + gravity.x;
                netVelocity.y += repulsion.y + attraction.y + gravity.y;
            });
            postA.update(netVelocity);
        });
    };

    // client for winchatty API. used to get chatty title, post data
    // browse winchatty here: http://winchatty.com/service/browser/
    // thanks electroly!
    function winchatty(args, success, failure) {
        var postArgs = {},
            i;
        for (i = 0; i < args.length; i++) {
            postArgs['arg' + i] = args[i];
        }
        $.ajax({
            url:      'http://winchatty.com/service/json',
            type:     'POST',
            data:     postArgs,
            dataType: 'json',
            cache:    false,
            success:  function (data, textStatus, jqXHR) {
                if (data.hasOwnProperty('faultString')) {
                    failure(data.faultString);
                } else {
                    success(data);
                }
            },
            error:    function (jqXHR, textStatus, errorThrown) {
                failure('Failed to call ' + args[0]);
            }
        });
    }

    function Reply() {
        this.attraction = 0.01;
        this.repulsion = 600;
        this.damping = 0.3;
    }

    function Post() {
        this.bounds = new Vector2(800, 600);
        this.baseSize = 8;
        this.hoveredSizeMultiplier = 2;
        this.selectedSizeMultiplier = 3;
        this.baseMass = 1;
        this.attraction = 0.01;
        this.repulsion = 600;
        this.damping = 0.7;
        this.selectedPost = null;
    }
    Post.prototype.size = function () {
        var multiplier = (this.isSelected() ? this.selectedSizeMultiplier : (this.isHovered ? this.hoveredSizeMultiplier : 1));
        return this.baseSize * multiplier + Math.sqrt(this.reply_count);
    };
    Post.prototype..mass = function () {
        return this.baseMass + 0.1 * Math.sqrt(this.reply_count);
    };
    Post.prototype..isSelected = function () {
        assert(this !== null);
        return this === this.selectedPost;
    };
    Post.prototype..backgroundColour = function () {
        var bgcolour = "black";
        if (!this.category) {
            bgcolour = "black";
        } else if (this.category === "ontopic") {
            bgcolour = "white";
        } else if (this.category === "offtopic") {
            bgcolour = "lightgrey";
        } else if (this.category === "nws") {
            bgcolour = "red";
        } else if (this.category === "political") {
            bgcolour = "blue";
        } else if (this.category === "stupid") {
            bgcolour = "yellow";
        } else if (this.category === "informative") {
            bgcolour = "green";
        }
        return bgcolour;
    };
    Post.prototype.getOpacity = function () {
        var isSelected = this.isSelected(),
            noneAreSelected = this.selectedPost === null;
        return ((noneAreSelected || isSelected) ? 1.0 : 0.5);
    };
    Post.prototype.update = function (velocity) {
        if (!this.isHovered) { // as long as we aren't mouseovered,
            // move to new position, apply some damping to encourage stabilization,
            this.position.x += velocity.x * this.damping;
            this.position.y += velocity.y * this.damping;

            // and finally ensure we don't go out of bounds.
            if (this.position.x < 0) { this.position.x = 0; this.velocity.x = 0; }
            if (this.position.x > this.bounds.x) { this.position.x = this.bounds.x; this.velocity.x = 0; }
            if (this.position.y < 0) { this.position.y = 0; this.velocity.y = 0; }
            if (this.position.y > this.bounds.y) { this.position.y = this.bounds.y; this.velocity.y = 0; }
        }

        // redraw
        $(this.div).css({
            'top':  this.position.y,
            'left': this.position.x,
            'background-color': this.backgroundColour(),
            'width': this.size(),
            'height': this.size()
        })
            .fadeTo(0, this.getOpacity());

        if (this.isSelected()) {
            this.updateReplies();
        }
        return this;
    };
    Post.prototype.updateReplies = function () {
        if (this.replyList === null) {
            this.replyList = [];
            winchatty(
                ["ChattyService.getThreadTree", this.id],
                getReplies,
                function (error) {
                    window.alert("Failed to access winchatty database: " + error);
                }
            );
        } else if (this.replyList.length !== 0) {
            var replyList = this.replyList;
            replyList.forEach(function (replyA) {
                var netVelocity = new Vector2(0, 0);
                replyList.forEach(function (replyB) {
                    if (replyA === replyB) {
                        return;
                    }
                    var repulsion = repulseFrom.call(replyA, replyB),
                        attraction = new Vector2(0, 0);
                    if ($.inArray(replyB, replyA.children) > -1 || $.inArray(replyA, replyB.children) > -1) {
                        attraction = attractTo.call(replyA, replyB);
                    }
                    netVelocity.x += repulsion.x + attraction.x;
                    netVelocity.y += repulsion.y + attraction.y;
                });
                if (replyA === this.replyTree) { // if root post
                    replyA.position = this.position;
                } else {
                    replyA.position.x += netVelocity.x * replyA.damping;
                    replyA.position.y += netVelocity.y * replyA.damping;
                }
                $(replyA.div).css({
                    'top':  replyA.position.y,
                    'left': replyA.position.x
                });
            });
        }
    };

    var attractTo = function (that) {
        var attraction = new Vector2(0, 0);
        attraction.x += this.mass() * this.attraction * (that.position.x - this.position.x);
        attraction.y += this.mass() * this.attraction * (that.position.y - this.position.y);
        return attraction;
    };
    var repulseFrom = function (that) {
        var repulsion = new Vector2(0, 0),
            rsq = Math.pow(this.position.x - that.position.x, 2) + Math.pow(this.position.y - that.position.y, 2);
        if (rsq === 0) { rsq = 0.00001; } // careful - don't divide by zero!
        repulsion.x = (this.repulsion * (this.position.x - that.position.x) / rsq);
        repulsion.y = (this.repulsion * (this.position.y - that.position.y) / rsq);
        return repulsion;
    };
    var applyGravity = function () {
        var centerOfGravity = new Vector2(this.bounds.x / 2, this.bounds.y / 2),
            gravity = new Vector2(0, 0);
        gravity.x = this.gravityAttraction * (centerOfGravity.x - this.position.x);
        gravity.y = this.gravityAttraction * (centerOfGravity.y - this.position.y);
        return gravity;
    };



    // Because I'm bad at Javascript scoping, I couldn't figure out how to put this in an anonymous function
    // inside the winchatty call in Post.prototype.updateReplies, and I couldn't figure out how to have it
    // be a function within Post.prototype and still be called with arguments.
    // So it's a standalone function.
    function getReplies(tree) {
        // http://programmers.stackexchange.com/questions/214227/
        var stack = [],
            replies = tree.replies,
            root = tree.replies[0];
        $.extend(root, Reply);
        root.children = [];
        root.position = new Vector2(0, 0);
        root.velocity = new Vector2(0, 0);
        root.div = jQuery('<div/>')
            .addClass('reply')
            .appendTo('#chatty');
        stack.push(root);
        for (var i = 1; i < replies.length; i++) { // start at i=1 deliberately to skip root, handled above
            var reply = replies[i],
                delta = reply.depth - stack.length;
            $.extend(reply, Reply);
            reply.children = [];
            reply.div = jQuery('<div/>')
                .addClass('reply')
                .appendTo('#chatty');
            reply.position = new Vector2(Math.random() * Post.prototype.bounds.x, Math.random() * Post.prototype.bounds.y);
            reply.velocity = new Vector2(0, 0);
            if (delta > 0) {
                assert(delta === 1);
                stack.push(stack.front().children.front());
            }
            while (delta < 0) {
                stack.pop();
                delta++;
            }
            stack.front().children.push(reply);
        }
        Post.prototype.selectedPost.replyList = replies;
        Post.prototype.selectedPost.replyTree = root;
    }

    function getThreads(story) {
        var posts = [];
        story.threads.forEach(function(thread) {
            $.extend(thread.prototype, Post);
            thread.replyList = null;
            thread.replyTree = null;
            thread.position = new Vector2(Math.random() * thread.bounds.x, Math.random() * thread.bounds.y);
            thread.velocity = new Vector2(0, 0);
            thread.isHovered = false;
            thread.div = jQuery('<div/>')
                .addClass('post')
                .appendTo('#chatty')
                .click(function (e) {
                    thread.isHovered = false;
                    Post.prototype.selectedPost = (thread.isSelected() ? null : thread); // a toggle
                    e.preventDefault();
                }).mouseenter(function () {
                    if (!thread.selected) { thread.isHovered = true; }
                }).mouseleave(function () {
                    thread.isHovered = false;
                });
            posts.push(thread);
        });
    }

    $('#title').text("Loading...");
    winchatty(
        ["ChattyService.getStories"],
        function (data) {
            var title = data[0].title,
                story_id = data[0].story_id;
            winchatty(
                ["ChattyService.getStory", story_id, 1],
                function (story) {
                    var posts = getThreads(story);
                    $('#title').text(title + ": " + story.story_name);
                    window.setInterval(function () {
                        postCalculationLoop(posts);
                    }, framerate);
                },
                function (error) {
                    window.alert("Failed to access winchatty database: " + error);
                }
            );
        },
        function (error) {
            window.alert("Failed to access winchatty database: " + error);
        }
    );

    /*$('#chatty').css({
        "height": Post.bounds.y,
        "width": Post.bounds.x
    });*/

    $('input[name=repulsion]').val(Post.prototype.repulsion);
    $('input[name=attraction]').val(Post.prototype.attraction);
    $('input[name=damping]').val(Post.prototype.damping);
    $('input[name=baseSize]').val(Post.prototype.baseSize);

    $('#controls').submit(function (event) {
        Post.prototype.repulsion = $('input[name=repulsion]').val();
        Post.prototype.attraction = $('input[name=attraction]').val();
        Post.prototype.damping = $('input[name=damping]').val();
        Post.prototype.baseSize = $('input[name=baseSize]').val();
        event.preventDefault();
    });
});