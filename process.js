var triangulate = require("delaunay-triangulate")
var PImage = require("pureimage");
var fs = require("fs");
var xml2json = require("xml2json");

const POINT_SIZE = 6;
const POINT_ROW_COUNT = 50;
const DO_DRAW_POINTS = true;

function generatePoints(width, height, numrows) {
	// var points = [];
	// for (var i = 0; i < numrows; i++) {
	// 	for (var j = 0; j < numrows; j++) {
	// 		points.push({
	// 			x: width * ((i + 0.5) / numrows),
	// 			y: height * ((j + 0.5) / numrows)
	// 		});
	// 	}
	// }
	// return points;

	var points = [];
	for (var i = 0; i < numrows; i++) {
		for (var j = 0; j < numrows; j++) {
			var i_bump = j % 2 ? 0.5 : 0;
			points.push({
				x: width * ((i + i_bump) / numrows),
				y: height * ((j + 0.5) / numrows)
			});
		}
	}
	return points;
}

function intColorToHex(color) {
	return "#" + ("0000000" + color.toString(16)).substr(-8);
}

function generateSvg(width, height, triangles) {
	var svgdata = {
		svg: {
			xmlns: "http://www.w3.org/2000/svg",
			"xmlns:svg": "http://www.w3.org/2000/svg",
			width: width,
			height: height,
			viewBox: `0 0 ${width} ${height}`
		}
	}
	svgdata.svg.g = {};
	svgdata.svg.g.path = triangles.map(triangle => {
		var [p1, p2, p3] = triangle.points;
		return {
			style: `fill:${triangle.color}`,
			d: `M ${p1.x},${p1.y} L ${p2.x},${p2.y} L ${p3.x},${p3.y} Z`
		};
	});
	return xml2json.toXml(JSON.stringify(svgdata));
}

PImage.decodePNGFromStream(fs.createReadStream("example.png")).then((img) => {
	var ctx = img.getContext("2d");

	// generate points
	var points = generatePoints(img.width, img.height, POINT_ROW_COUNT);
	points = points.filter(point => {
		var pixel = img.getPixelRGBA(point.x, point.y);
		return pixel != 0;
	})
	var points_flat = points.map(point => [ point.x, point.y ]);

	// generate triangles (lists of indexes)
	var triangles = triangulate(points_flat);

	// generate triangle colors
	var triangle_colors = triangles.map(triangle => {
		var tripoints = triangle.map(idx => points[idx]);
		var avgx = tripoints.map(pt => pt.x).reduce((a, b) => a + b) / tripoints.length;
		var avgy = tripoints.map(pt => pt.y).reduce((a, b) => a + b) / tripoints.length;
		return intColorToHex(img.getPixelRGBA(avgx, avgy));
	});

	// draw triangles
	ctx.strokeStyle = "red";
	for (var i = 0; i < triangles.length; i++) {
		var triangle = triangles[i];
		var color = triangle_colors[i];

		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.moveTo(...points_flat[triangle[triangle.length - 1]]);
		triangle.forEach(idx => ctx.lineTo(...points_flat[idx]));
		ctx.fill();
		ctx.stroke();
	}

	// draw points
	if (DO_DRAW_POINTS) {
		ctx.fillStyle = "green";
		points.forEach(point => {
			ctx.fillRect(point.x - (POINT_SIZE / 2), point.y - (POINT_SIZE / 2), POINT_SIZE, POINT_SIZE);
		});
	}

	var svgtext = generateSvg(img.width, img.height, triangles.map((point_idxs, i) => {
		return {
			points: point_idxs.map(idx => points[idx]),
			color: triangle_colors[i]
		}
	}));
	fs.writeFileSync("out.svg", svgtext);
	// save
	PImage.encodePNGToStream(img, fs.createWriteStream("out.png")).then(() => {
		console.log("done writing");
	});
});