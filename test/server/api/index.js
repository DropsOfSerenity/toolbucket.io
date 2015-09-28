var Lab = require('lab');
var Code = require('code');
var Config = require('../../../config');
var Hapi = require('hapi');
var IndexPlugin = require('../../../server/api/index');
var Sinon = require('sinon');
var request = require('request');


var lab = exports.lab = Lab.script();
var invalidUSPSResponse,
    requestStub,
    server,
    validRequest,
    validUSPSResponse,
    validUSPSResponseWithMessage;


lab.beforeEach(function (done) {

    var plugins = [IndexPlugin];
    server = new Hapi.Server();
    server.connection({ port: Config.get('/port/web') });
    server.register(plugins, function (err) {

        if (err) {
            return done(err);
        }

        done();
    });
});


lab.experiment('Index Plugin', function () {

    validUSPSResponse = '<?xml version="1.0" encoding="UTF-8"?><AddressValidateResponse><Address><Address2>1600 AMPHITHEATRE PKWY</Address2><City>MOUNTAIN VIEW</City><State>CA</State><Zip5>94043</Zip5><Zip4>1351</Zip4></Address></AddressValidateResponse>';
    invalidUSPSResponse = '<?xml version="1.0" encoding="UTF-8"?><AddressValidateResponse><Address><Error><Number>-2147219401</Number><Source>clsAMS</Source><Description>Address Not Found.  </Description><HelpFile/><HelpContext/></Error></Address></AddressValidateResponse>';
    validUSPSResponseWithMessage = '<?xml version="1.0" encoding="UTF-8"?><AddressValidateResponse><Address><Address2>1188 MISSION ST</Address2><City>SAN FRANCISCO</City><State>CA</State><Zip5>94103</Zip5><Zip4>1586</Zip4><ReturnText>Default address: The address you entered was found but more information is needed (such as an apartment, suite, or box number) to match to a specific address.</ReturnText></Address></AddressValidateResponse>';
    validRequest = {
        method: 'POST',
        url: '/verify/address',
        payload: {
            address_line1: '1600 Amphitheatre Pkwy',
            address_zip: '94043'
        }
    };

    lab.beforeEach(function (done) {

        requestStub = Sinon.stub(request, 'get');
        done();
    });

    lab.afterEach(function (done) {

        requestStub.restore();
        done();
    });

    lab.test('it works with a valid request', function (done) {

        requestStub.yields(null, { statusCode: 200 }, validUSPSResponse);
        server.inject(validRequest, function (response) {

            Code.expect(response.statusCode).to.equal(200);
            Code.expect(response.result.address).to.be.an.object();

            done();
        });
    });

    lab.test('it handles an error response from USPS', function (done) {

        requestStub.yields(null, { statusCode: 200 }, invalidUSPSResponse);
        server.inject(validRequest, function (response) {

            Code.expect(response.statusCode).to.equal(422);
            Code.expect(response.result.message).to.equal('Address Not Found.');

            done();
        });
    });

    lab.test('when usps returns a message, so do we', function (done) {

        requestStub.yields(null, { statusCode: 200 }, validUSPSResponseWithMessage);
        server.inject(validRequest, function (response) {

            Code.expect(response.statusCode).to.equal(200);
            Code.expect(response.result.message).to.be.a.string();
            done();
        });
    });

    lab.test('it returns 422 with an invalid request', function (done) {

        var invalidRequest = {
            method: 'POST',
            url: '/verify/address'
        };
        server.inject(invalidRequest, function (response) {

            Code.expect(response.statusCode).to.equal(422);
            Code.expect(response.result.message).to.contain('ValidationError');

            done();
        });
    });

});
