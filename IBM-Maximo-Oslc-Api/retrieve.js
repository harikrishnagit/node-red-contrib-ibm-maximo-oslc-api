"use strict";

var connect = require('./connect.js');
var request = require('request');
var mustache = require('mustache');

var message;
var objectStructure;
var resourceType;
var qs;

module.exports = function(RED) {
    function MaximoRetrieve(config) {
        RED.nodes.createNode(this, config);

		this.on('input', function(msg) {
			message = msg;
			qs = {};
			objectStructure = config.resource;
			resourceType = config.resourceType;
			var localContext = this.context().flow.global;
			var connectionName = RED.nodes.getNode(config.maximoConnection).name.replace(' ', '');
			var sessionInfo = localContext.get(connectionName);
			var lean = sessionInfo.lean;
			var tenantCode = sessionInfo.tenantCode;

			var select = config.select;
			var where = config.where;
			var orderBy = config.orderBy;
			var pageSize = config.pageSize;
			var pageNumber = config.pageNumber;
			var searchAttributes = config.searchAttributes;
			var searchTerms = config.searchTerms;
			var respFormat = config.respFormat;
			var addSchema = config.addSchema;
			var collectionCount = config.collectionCount;

			if(lean)
				qs.lean = 1;

			if(tenantCode) {
				if(tenantCode.indexOf("{{") != -1)
					tenantCode = mustache.render(tenantCode, message);

				qs._tenantcode = tenantCode;
			}

			if(objectStructure.indexOf("{{") != -1)
				objectStructure = mustache.render(objectStructure, message);

			if(select) {
				if(select.indexOf("{{") != -1)
					select = mustache.render(select, message);

				qs['oslc.select'] = select;
			}
			if(where) {
				if(where.indexOf("{{") != -1)
					where = mustache.render(where, message);


				qs['oslc.where'] = where;
			}

			if(orderBy) {
				if(orderBy.indexOf("{{") != -1)
					orderBy = mustache.render(orderBy, message);

				qs['oslc.orderBy'] = orderBy;
			}

			if(pageSize) {
				if(pageSize.indexOf("{{") != -1)
					pageSize = mustache.render(pageSize, message);

				qs['oslc.pageSize'] = pageSize;
			}

			if(pageNumber) {
				if(pageNumber.indexOf("{{") != -1)
					pageNumber = mustache.render(pageNumber, message);

				qs.pageno = pageNumber;
			}

			if(searchAttributes) {
				if(searchAttributes.indexOf("{{") != -1)
					searchAttributes = mustache.render(searchAttributes, message);

				qs.searchAttributes = searchAttributes;
			}

			if(searchTerms) {
				if(searchTerms.indexOf("{{") != -1)
					searchTerms = mustache.render(searchTerms, message);

				qs['oslc.searchTerms'] = searchTerms;
			}

			if(respFormat !== 'json') {
				if(respFormat.indexOf("{{") != -1)
					respFormat = mustache.render(respFormat, message);

				qs._format = respFormat;
			}

			if(addSchema)
				qs.addSchema = 1;

			if(collectionCount)
				qs.collectioncount = 1;

			// Check if we are already connected to Maximo
			if(sessionInfo.session === null) { // Connect
				connect(this, message, sessionInfo, localContext, connectionName, retrieve);
			} else // Reuse the existing connection
				retrieve(this, message, sessionInfo);
        });
    }

    RED.nodes.registerType('retrieve', MaximoRetrieve);
}

function retrieve(node, message, sessionInfo) {
	node.status({fill:"green",shape:"ring",text:"sending"});
	var url;

	if(resourceType === "objectStructure")
		url = sessionInfo.url + '/os/' + encodeURI(objectStructure);
	else
		url = encodeURI(objectStructure);

	var opts = {
		method: 'GET',
		url: url,
		qs: qs,
		headers: {
			Cookie: sessionInfo.session,
			'x-public-uri': sessionInfo.url
		},
	    rejectUnauthorized: sessionInfo.rejectUnauthorized
	};

    node.warn(JSON.stringify(opts));



	request(opts, function (error, response, body) {
		message.maximo = {
			request: opts,
			response: {}
		};

		if(error != null) {
			node.status({fill:"red",shape:"dot",text:"error on retrieve"});
			if(Object.keys(error) > 0) {
				message.maximo.response.error = JSON.stringify(error);

			} else {
				message.maximo.response.error = error;
			}
			node.warn(error.length);
			node.warn(error);
			node.send(message);
			return;
		}
		message.maximo.response.statusCode = response.statusCode;
		message.maximo.response.headers = response.headers;
		message.maximo.response.payload = JSON.parse(body);

		if(response.statusCode !== 200)
			node.status({fill:"red",shape:"dot",text:"not retrieved"});
		else
			node.status({fill:"green",shape:"dot",text:"retrieved"});

		node.send(message);
	});
}
