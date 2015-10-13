// Reads a JSON file output by syssci.renci.org/ssm and displays many of its
// characteristics in boingified mode, that is, as a force-directed graph which
// uses intermediate nodes to to create Bezier-curved links.
//


// http://stackoverflow.com/questions/21631127/find-the-array-index-of-an-object-with-a-specific-key-value-in-underscore
Array.prototype.getIndexBy = function (name, value) {
  for (var i = 0; i < this.length; i++) {
    if (this[i][name] == value) {
      return i;
    }
  }
};


var setupUpload = function() {
  var thisGraph = this;
  d3.select("#upload-input")
    .on("click", function() {
      document.getElementById("hidden-file-upload").click();
    });

  d3.select("#hidden-file-upload").on("change", function() {
    if (window.File && window.FileReader && window.FileList && window.Blob) {
      var uploadFile = this.files[0];
      var fileReader = new window.FileReader();
      fileReader.filename = uploadFile.name;
      var txtRes;

      fileReader.onload = function(e) {
        try {
          txtRes = fileReader.result;
	  var filename = this.filename;
	  d3.select("h3").html(filename);
        } catch(err) {
          window.alert("Error reading file: " + err.message);
        }
        return drawGraph(null, JSON.parse(txtRes));
      };
      fileReader.readAsText(uploadFile);
    } else {
      alert("Your browser won't let you read this file -- try upgrading your browser to IE 10+ "
          + "or Chrome or Firefox.");
    }
  });
};


// http://javascript.crockford.com/memory/leak.html
function purge(d) {
  var a = d.attributes, i, l, n;
  if (a) {
    for (i = a.length - 1; i >= 0; i -= 1) {
      n = a[i].name;
      if (typeof d[n] === 'function') {
        d[n] = null;
      }
    }
  }
  a = d.childNodes;
  if (a) {
    l = a.length;
    for (i = 0; i < l; i += 1) {
      purge(d.childNodes[i]);
    }
  }
};


function drawGraph(error, graph) {
  var oldNodes = d3.selectAll("svg *")[0];
  oldNodes.forEach(function(node) {
    purge(node);
  });
  d3.selectAll("svg *").remove();
  d3.selectAll(".d3-tip").remove();

  var nodes = graph.nodes.slice();
  var links = [];
  var bilinks = [];

  // Set up control points for Bezier curves:
  graph.links.forEach(function(link) {
    var si = nodes.getIndexBy("id", link.source);
    var s = nodes[si];
    var ti = nodes.getIndexBy("id", link.target);
    var t = nodes[ti];
    var i = {}; // intermediate node
    var style = link.style;
    nodes.push(i);
    links.push({source: s, target: i}, {source: i, target: t});
    bilinks.push([s, i, t, style, link.color]);
  });

  // Set up force:
  var force = d3.layout.force()
      .nodes(nodes)
      .links(links)
      .size([w, h])
      .linkDistance(40)
      .linkStrength(2)
      .friction(0.9)
      .gravity(0.15)
      .charge(-170)
      .on("tick", function() {
	var q = d3.geom.quadtree(nodes),
	    i = 0,
	    n = nodes.length;
	while (++i < n) q.visit(collide(nodes[i]));

        paths.attr("d", function(d) { // Path to node border, not center
          deltaX = d[2].x - d[0].x,
          deltaY = d[2].y - d[0].y,
          dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
          normX = deltaX /dist,
          normY = deltaY / dist,
          targetX = d[2].x - (normX * (r - 4)),
          targetY = d[2].y - (normY * (r - 4));
          return "M" + d[0].x + "," + d[0].y // moveto absolute
               + "S" + d[1].x + "," + d[1].y // cubic Bezier curveto absolute
               + " " + targetX + "," + targetY;
        });
        gnodes.attr("transform", transform);
       })
      .start();

  // Create arrow heads:
  linkColors = [];
  
  graph.links.forEach(function(link) {
    if (linkColors.indexOf(link.color) === -1) {
      linkColors.push(link.color);
    }
  });
 
  svg.append("defs").selectAll("marker")
     .data(linkColors)
     .enter().append("marker")
       .attr("id", function(d) {
          return "a" + d;
       })
       .attr("fill", function(color) {
         return color;
       })
       .attr("stroke", function(color) { return color; })
       .attr("viewBox", "0 -5 10 10")
       .attr("refX", 15)
       .attr("refY", -1.5)
       .attr("markerWidth", 6)
       //.attr("markerWidth", function(d) { return (d.visible == true? 6 : 0); })
       //.attr("markerHeight", function(d) { return (d.visible == true? 6 : 0); })
       .attr("markerHeight", 6)
       .attr("orient", "auto")
     .append("path")
     .attr("d", "M0,-5L10,0L0,5");

  // Paths:
  var paths = svg.append("g").selectAll("path")
      .data(bilinks)
    .enter().append("path")
      .classed("link", true)
      .attr("class", function(d) {
        return d[3];
      })
      .style("stroke", function(d) {
        return d[4];
      })
      .attr("marker-end", function(d) {
        return "url(#a" + d[4] + ")";
      });

  // Create the groups for holding circle/text units:
  var gnodes = svg.append("g").selectAll(".gnode")
      .data(graph.nodes)
    .enter()
      .append("g")
      .classed("gnode", true)
      .attr("id", function(d) { return "node" + d.id; })
      .call(force.drag);
  
  // Add one circle to each group of class gnode:
  gnodes.append("svg:a")
           .attr("xlink:href", function(d){return d.url;})
           .attr("x", function(d) { return d.x; })
           .attr("y", function(d) { return d.y; })
           .attr("px", function(d) { return d.x; })
           .attr("py", function(d) { return d.y; })
        .append("circle")
          .attr("r", r)
          .style("fill", "#ffffff")
          .style("stroke", function(d) {
            return d.color; 
          })
          .style("stroke-width", "1px")
          .classed("node", true)
        .on("rightclick", function(d) { 
            d3.event.stopPropagation();
          });

  //Set up tooltips:
  var tip = d3.tip()
              .attr("class", "d3-tip")
              .offset([-10, 0])
              .style("font-family", "Arial")
              .style("font-weight", "bold")
              .html(function (d) {
                return  d.note ? d.note + "" : "";
              })
            svg.call(tip);
  
  // Append a label to each group of class gnode:
  gnodes.append("text")
      .text(function(d) { return d.name; })
      .style("fill", function(d) {
        return d.color;
       })
      .attr("dy", ".21em")
      .classed("nodeName", true)
    .on('mouseover', tip.show)
    .on('mouseout', tip.hide);

  // Slow down the jitter at the start:
  gnodes.transition()
      .duration(750)
      .delay(function(d, i) { return i * 5; })
      .attrTween("r", function(d) {
	var i = d3.interpolate(0, d.radius);
	return function(t) { return d.radius = i(t); };
      });

  
  function collide(node) {
    //var r = node.radius + 16,
    var r = 35,
	nx1 = node.x - r,
	nx2 = node.x + r,
	ny1 = node.y - r,
	ny2 = node.y + r;
    return function(quad, x1, y1, x2, y2) {
      if (quad.point && (quad.point !== node)) {
	var x = node.x - quad.point.x,
	    y = node.y - quad.point.y,
	    l = Math.sqrt(x * x + y * y),
	    r = node.radius + quad.point.radius;
	if (l < r) {
	  l = (l - r) / l * 0.5;
	  node.x -= x *= l;
	  node.y -= y *= l;
	  quad.point.x += x;
	  quad.point.y += y;
	}
      }
      return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
    };
  };
}


function transform(d) {
  return "translate(" + d.x + "," + d.y + ")";
}


// MAIN:
var body = d3.select("body");
var docEl = document.documentElement;
var w = window.innerWidth || docEl.clientWidth;
    h = window.innerHeight|| docEl.clientHeight;
var r = 14;

var inputFilename = "Philip17X.json";
body.append("h3").text(inputFilename);

var svg = body.append("svg:svg")
    .attr("width", w)
    .attr("height", h)
    // hack: doubling xmlns: so it doesn't disappear once in the DOM
    .attr({"xmlns": "http://www.w3.org/2000/svg",
          "xmlns:xmlns:xlink": "http://www.w3.org/1999/xlink", 
          version: "1.1"
         });
setupUpload();
d3.json(inputFilename, drawGraph);

