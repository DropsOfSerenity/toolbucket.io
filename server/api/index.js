var Hoek = require('hoek');
var Joi = require('joi');
var Boom = require('boom');
var xml2js = require('xml2js');
var req = require('request');

var parser = new xml2js.Parser({
    explicitArray: false
});

var USPS_VERIFICATION_API = 'http://production.shippingapis.com/ShippingAPI.dll?API=Verify&XML=';
var API_PARAM_MAP = {
    Address2: 'address_line1',
    Address1: 'address_line2',
    City: 'address_city',
    State: 'address_state',
    Zip5: 'address_zip'
};
var USPS_API_USER_ID = '829ENIGM3242';

exports.register = function (server, options, next) {

    var validationSchema = Joi.alternatives().try(
        Joi.object().keys({
            address_line1: Joi.string().required(),
            address_line2: Joi.string().allow('').default(''),
            address_city: Joi.string().allow('').default(''),
            address_state: Joi.string().allow('').default(''),
            address_zip: Joi.string().required(),
            address_country: Joi.string().allow('').default('').max(2)
        }),
        Joi.object().keys({
            address_line1: Joi.string().required(),
            address_line2: Joi.string().allow('').default(''),
            address_city: Joi.string().required(),
            address_state: Joi.string().required(),
            address_zip: Joi.string().allow('').default(''),
            address_country: Joi.string().allow('').default('').max(2)
        })
    );

    server.route({
        method: 'POST',
        path: '/verify/address',
        handler: function (request, reply) {

            var builder = new xml2js.Builder({
                headless: true
            });
            var obj = {
                AddressValidateRequest: {
                    $: { USERID: USPS_API_USER_ID },
                    Address: {
                        Address1: request.payload.address_line2,
                        Address2: request.payload.address_line1,
                        City: request.payload.address_city,
                        State: request.payload.address_state,
                        Zip5: request.payload.address_zip,
                        Zip4: ''
                    }
                }
            };
            var xml = builder.buildObject(obj);
            var requestUrl = USPS_VERIFICATION_API + xml;
            makeUSPSRequest(requestUrl, function (err, response) {

                if (err) {
                    reply(Boom.badData(err));
                }
                else {
                    parseUSPSResponse(response, function (err, parsedResponse) {

                        reply(parsedResponse);
                    });
                }
            });
        },

        config: {
            validate: {
                payload: validationSchema,
                failAction: function (request, reply, source, error) {

                    reply(Boom.badData(error.data));
                }
            }
        }

    });

    next();
};

var makeUSPSRequest = function (requestUrl, cb) {

    req.get({
        url: requestUrl,
        headers: { 'Content-Type': 'text/xml' }
    }, function (error, response, body) {

        parser.parseString(body, function (err, result) {

            var resError = result.AddressValidateResponse.Address.Error;
            if (resError) {
                return cb(resError.Description.trim());
            }
            cb(null, result.AddressValidateResponse.Address);
        });
    });
};

var parseUSPSResponse = function (resp, cb) {

    var parsedResponse = {};
    for (var field in resp) {
        var convertedField = API_PARAM_MAP[field];
        if (convertedField) {
            parsedResponse[convertedField] = resp[field];
            if (convertedField === 'address_zip' && resp.Zip4) {
                parsedResponse[convertedField] += '-' + resp.Zip4;
            }
        }
    }

    if (resp.ReturnText) {
        var message = resp.ReturnText;
    }

    return cb(null, {
        message: message,
        address: parsedResponse
    });
};

exports.register.attributes = {
    name: 'api'
};
