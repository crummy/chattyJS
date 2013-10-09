/*
$.fn.click(function(e) {
    this.selected = true;
    e.stopPropagation();
});
$.fn.mouseover(function() {
    this.hovered = true;
});
$.fn.mouseleave(function () {
    this.hovered = false;
});*/

$(function () {
    var framerate = 1000 / 30;

    // Simple little Vector2 class for physics calculations
    function Vector2(x, y) {
        this.x = x;
        this.y = y;
    }

    // Applies a force-based calculation to every post.
    // mostly thanks to http://blog.ivank.net/force-based-graph-drawing-in-as3.html
    function forceCalculationLoop(posts) {
        posts.forEach(function(postA) {
            var netVelocity = new Vector2(0 ,0);
            posts.forEach(function(postB) {
                if (postA === postB) {
                    return; // no need to compare a node to itself
                }
                var repulsion = postA.repulseFrom(postB),
                    attraction = postA.attractTo(postB),
                    gravity = postA.applyGravity();
                netVelocity.x += repulsion.x + attraction.x + gravity.x;
                netVelocity.y += repulsion.y + attraction.y + gravity.y;
            });
            postA.move(netVelocity);
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

    function Post(data) {
        this.data = data;
        this.velocity = new Vector2(Math.random() * this.bounds.x, Math.random() * this.bounds.y);
        this.position = new Vector2(0, 0);
        this.hovered = false;
        this.selected = false;
        this.div = jQuery('<div/>')
            .addClass('circle')
            .text('+')
            .appendTo('#chatty')
            .css({
                'top': this.position.y,
                'left': this.position.x,
                'background-color': this.backgroundColour,
                'width': this.size,
                'height': this.size
            }).click(function (e) {
                this.selected = true;
                e.preventDefault();
            }).mouseenter(function () {
                this.hovered = true;
            }).mouseleave(function () {
                this.hovered = false;
            });
    }
    Post.prototype.bounds = new Vector2(800, 600);
    Post.prototype.baseSize = 8;
    Post.prototype.hoverSizeMultiplier = 2;
    Post.prototype.selectedSizeMultiplier = 2;
    Post.prototype.baseMass = 1;
    Post.prototype.hoverMassMultiplier = 2;
    Post.prototype.selectedMassMultiplier = 2;
    Post.prototype.attraction = 0.01;
    Post.prototype.repulsion = 800;
    Post.prototype.damping = 0.7;
    Post.prototype.size = function () {
        if (!this.data) {
            return this.baseSize;
        }
        return this.baseSize + Math.sqrt(this.data.reply_count);
    };
    Post.prototype.mass = function () {
        return this.baseMass + 0.1 * Math.sqrt(this.data.reply_count);
    };
    Post.prototype.backgroundColour = function () {
        var bgcolour = "black";
        if (!this.data) {
            bgcolour = "black";
        } else if (this.data.category === "ontopic") {
            bgcolour = "white";
        } else if (this.data.category === "offtopic") {
            bgcolour = "lightgrey";
        } else if (this.data.category === "nws") {
            bgcolour = "red";
        } else if (this.data.category === "political") {
            bgcolour = "blue";
        } else if (this.data.category === "stupid") {
            bgcolour = "yellow";
        } else if (this.data.category === "informative") {
            bgcolour = "green";
        }
        return bgcolour;
    };
    Post.prototype.attractTo = function (that) {
        var attraction = new Vector2(0, 0);
        if (this.data.category === that.data.category) {
            attraction.x += this.mass * this.attraction * (that.x - this.x);
            attraction.y += this.mass * this.attraction * (that.y - this.y);
        }
        return attraction;
    };
    Post.prototype.repulseFrom = function (that) {
        var repulsion = new Vector2(0, 0),
            rsq = ((this.x - that.x) * (this.x - that.x) + (this.y - that.y) * (this.y - that.y));
        if (rsq === 0) {
            rsq = 0.00001; // careful - don't divide by zero!
        }
        repulsion.x = this.repulsion * (this.x - that.x) / rsq;
        repulsion.y = this.repulsion * (this.y - that.y) / rsq;
        return repulsion;
    };
    Post.prototype.applyGravity = function () {
        var centerOfGravity = new Vector2(this.bounds.x / 2, this.bounds.y / 2);
        var gravity = new Vector2(0, 0);
        gravity.x = this.attraction * (centerOfGravity.x - this.x);
        gravity.y = this.attraction * (centerOfGravity.y - this.y);
        return gravity;
    };
    Post.prototype.move = function (velocity) {
        //if (this.selected || this.hovered) return;
        this.position.x += velocity.x * this.damping;
        this.position.y += velocity.y * this.damping;

        // ensure we don't go out of bounds
        if (this.position.x < 0) { this.position.x = 0; this.velocity.x = 0; }
        if (this.position.x > this.bounds.x) { this.position.x = this.bounds.x; this.velocity.x = 0; }
        if (this.position.y < 0) { this.position.y = 0; this.velocity.y = 0;}
        if (this.position.y > this.bounds.y) { this.position.y = this.bounds.y; this.velocity.y = 0; }

        $(this.div).css({
            'top':  this.position.y,
            'left': this.position.x
        });
        return this;
    };

    $('#title').text("Loading...");
    winchatty(
        ["ChattyService.getStories"],
        function (data) {
            var title = data[0].title,
                story_id = data[0].story_id;
            winchatty(
                ["ChattyService.getStory", story_id, 2],
                function (story) {
                    var posts = [];
                    story.threads.forEach(function(thread) {
                        posts.push(new Post(thread));
                    });
                    $('#title').text(title + ": " + story.story_name);
                    window.setInterval(function() { forceCalculationLoop(posts); }, framerate);
                },
                function(error) {
                    alert("Failed to access winchatty database: " + error);
                }
            );
        },
        function(error) {
            alert("Failed to access winchatty database: " + error);
        }
    );

    $('#chatty').css({
        "height": Post.prototype.bounds.y,
        "width": Post.prototype.bounds.x
    });

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