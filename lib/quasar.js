'use strict';

const urljoin = require('url-join');
const querystring = require('querystring');
const axios = require('axios');
const md5 = require('md5');
const HTMLParser = require('node-html-parser');
const URLParser = require('url-parse');

class Quasar {
    constructor(username, password) {
        this.username = username;
        this.password = password;
        this.csrf = null;
        this.cookies = null;
    }

    async login(force = false) {
        var processData = await this.getProcessData();

        if (processData === undefined) {
            return this.errorResponse('Incorrect process data');
        }

        var processData = await this.firstStep(processData);

        if (!('track_id' in processData)) {
            return this.errorResponse('Incorrect track_id');
        }

        return this.secondStep(processData);
    }

    getProcessData() {
        return axios.get("https://passport.yandex.ru/auth")
            .then(result => {
                var cookies = this.assemblyCookies(result.headers['set-cookie']);

                var data = HTMLParser.parse(result.data);
                var csrf = data.querySelector("[name=csrf_token]").getAttribute('value');
                var process_uuid = URLParser(data.querySelector("[data-t='button:pseudo']").getAttribute('href'), true)
                    .query
                    .process_uuid
                ;

                return {
                    cookies: cookies,
                    csrf: csrf,
                    process_uuid: process_uuid
                };
            }).catch(error => {
                console.log(error);

                return undefined;
            });
    }

    firstStep(processData) {
        return axios.post(
            "https://passport.yandex.ru/registration-validations/auth/multi_step/start",
            querystring.stringify({
                csrf_token: processData.csrf,
                login: this.username,
                process_uuid: processData.process_uuid,
            }),
            {headers: {'Cookie': processData.cookies}}
        ).then(result => {
            processData.track_id = result.data.track_id

            return processData;
        }).catch(error => {
            console.log(error);

            return undefined;
        });
    }

    secondStep(processData) {
        return axios.post(
            "https://passport.yandex.ru/registration-validations/auth/multi_step/commit_password",
            querystring.stringify({
                csrf_token: processData.csrf,
                track_id: processData.track_id,
                password: this.password,
                retpath: 'https://yandex.ru/quasar/iot'
            }),
            {headers: {'Cookie': processData.cookies}}
        ).then(result => {
            if (result.data.status !== 'ok') {
                return undefined;
            }

            this.cookies = processData.cookies + this.assemblyCookies(result.headers['set-cookie']);

            return this.cookies;
        }).catch(error => {
            console.log(error);

            return undefined;
        });
    }

    logout() {
        return axios.get(
            'https://passport.yandex.ru/passport?mode=embeddedauth&action=logout&origin=passport_profile_head_logout&retpath=https%3A%2F%2Fpassport.yandex.ru%2Fprofile&'
        );
    }

    token() {
        return axios.get(
            'https://yandex.ru/quasar/iot',
            {headers: {'Cookie': this.cookies}}
        ).then(result => {
            var csrf = result.data;
            csrf = csrf.substring(csrf.indexOf('"csrfToken2":"'));
            csrf = csrf.substring(csrf.indexOf('":"'), csrf.indexOf('","'));

            this.csrf = csrf.replace(new RegExp('":"', 'g'), '');

            return this.csrf;
        }).catch(error => {
            console.log(error);

            return undefined;
        });
    }

    async scenarioRun(scenarioId) {
        var token = await this.token();

        if (token === undefined) {
            return this.errorResponse('Not found csrf token');
        }

        return axios.post(
            'https://iot.quasar.yandex.ru/m/user/scenarios/' + scenarioId + '/actions',
            {},
            {headers: {'Cookie': this.cookies, 'x-csrf-token': this.csrf}}
        );
    }

    errorResponse(errors) {
        return new Promise(function (resolve, reject) {
            reject(errors);
        });
    }

    assemblyCookies(cookies) {
        var stringCookies = '';
        cookies.forEach(function(item, i, arr) {
            stringCookies += item.substring(0, item.indexOf('; ')) + ";";
        });

        return stringCookies;
    }
}

module.exports = Quasar;
