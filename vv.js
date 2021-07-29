let logger = require('../log')


module.exports.getCredentials = function() {
    let options = {
        customerAlias: "Intelidata",
        databaseAlias: "Default",
        userId: "mcifuentes@intelidata.cl",
        password: "YeoPQoFs",
        clientId: "75a46bd5-80e5-4d90-ac09-22ca908ee96d",
        clientSecret: "5otb5baRXIWdsPyttT472Xzhe19dAW0PFeEimN8rrkc="
    };
    return options
};

module.exports.main = async function(vvClient, response, token) {
    logger.info(`Start of the process PersonalLiabilitySCHExpirationReminder at ${Date()}`)

    response.json('200', 'Process started, please check back in this log for more information as the process completes.')

    // Queries used in getCustomQueryResultsByName calls (SQL Query)
    let queryNameProviderExpiration = 'MAPFRE_PROPOSTA_DE_ADESÃO_Correo_envio'

    // Maximum Recursive Loops
    let maxLoops = 10

    // Template ID
    let PersonalLiabilityInsuranceTemplateID = 'MAPFRE_PROPOSTA_DE_ADESÃO'


    // Array for capturing error messages that may occur.
    let errorLog = []
        // Track if any providers were found with Personal Liability Insurance coming up for expiration.  
    let providersFound = false
    let recursiveLoops = 0
        //*************************************************************** */
        //*************************************************************** */
        //GetToken function
        //CALLING END POINT RETURNING VALID TOKEN 
        //  0 - SUCCESFULLY CALLING
        // -1 - DESCRIPTION ERROR
        //return new Promise((resolve, reject) => {
    async function GetToken(AuthorizationUsername, AuthorizationPassword, Authorizationgrant_type, urltoken,
        BodyUsername, BodyPassword, Bodygrant_type, ContentType) {

        return new Promise(async function(resolve) {
            try {
                var objToken = '-1';
                var details = {
                    'username': AuthorizationUsername,
                    'password': AuthorizationPassword,
                    'grant_type': Authorizationgrant_type
                };
                var formBody = [];
                for (var property in details) {
                    var encodedKey = encodeURIComponent(property);
                    var encodedValue = encodeURIComponent(details[property]);
                    formBody.push(encodedKey + "=" + encodedValue);
                }
                formBody = formBody.join("&");
                //var auth = "Basic " + new Buffer(AuthorizationUsername + ":" + AuthorizationPassword).toString("base64");
                var auth = "Basic " + new Buffer.from(AuthorizationUsername + ":" + AuthorizationPassword).toString("base64");
                var request = require('request');
                request.post({
                        url: urltoken,
                        form: { username: BodyUsername, password: BodyPassword, grant_type: Bodygrant_type },
                        headers: {
                            'Authorization': auth,
                            'Content-Type': ContentType
                        },
                        method: 'POST'
                    },
                    function(error, response, body) {
                        objToken = JSON.parse(response.body);
                        //console.log('obj.access_token : ', objToken.access_token);                                              
                        resolve(objToken.access_token);
                    });
            } catch (error) {
                errorLog.push(error)
                resolve()
            }
        })
    }
    //*************************************************************** */
    //*************************************************************** */
    //sendEmailCCM function
    //jsonEmail=> json parameters
    //urlEmail=> urlEmail end point
    //headerAuthorization => header Authorization parameter
    //headerContentType => header ContentType parameter
    async function sendEmailCCM(jsonEmail, urlEmail, headerAuthorization, headerContentType) {
        return new Promise(async function(resolve) {
            try {
                var request = require('request');
                //var jsonlocal = JSON.parse(jsonEmail);
                request.post({
                    url: urlEmail,
                    json: jsonEmail,
                    //json: jsonlocal,               
                    headers: {
                        'Authorization': headerAuthorization,
                        'Content-Type': headerContentType
                    },
                    method: 'POST'
                }, function(error, response, body) {
                    resolve(response);
                });
            } catch (error) {
                errorLog.push(error)
                resolve()
            }
        })
    }


    //*************************************************************** */
    //*************************************************************** */
    //signCCM function
    //jsonSign=> json parameters
    //urlEmail=> urlEmail end point
    //headerAuthorization => header Authorization parameter
    //headerContentType => header ContentType parameter
    async function signCCM(jsonSign, urlsign, headerAuthorization, headerContentType) {
        return new Promise(async function(resolve) {
            try {
                var request = require('request');
                //var jsonlocal = JSON.parse(jsonEmail);
                request.post({
                    url: urlsign,
                    json: jsonSign,
                    headers: {
                        'Authorization': headerAuthorization,
                        'Content-Type': headerContentType
                    },
                    method: 'POST'
                }, function(error, response, body) {
                    resolve(response);
                });
            } catch (error) {
                errorLog.push(error)
                resolve()
            }
        })
    }

    /*******************
     RECURSIVE FUNCTIONS
    ********************/
    async function notifyProviders() {
        return new Promise(async function(resolve) {
            try {
                // STEP 1A - Call getCustomQueryResultsByName to find all Personal Liability Insurance records where the 60-day Expiration Reminder Sent checkbox is not checked, is in an 'Active' status, the coverage end date is less than 60 days in the future, and the related Individual Record is also in an 'Active' status.
                let queryParams = { filter: '' }

                let customQueryProvidersResp = await vvClient.customQuery.getCustomQueryResultsByName(queryNameProviderExpiration, queryParams)
                customQueryProvidersResp = JSON.parse(customQueryProvidersResp)
                let customQueryProvidersData = (customQueryProvidersResp.hasOwnProperty('data') ? customQueryProvidersResp.data : null)
                let customQueryProvidersLength = (Array.isArray(customQueryProvidersData) ? customQueryProvidersData.length : 0)

                if (customQueryProvidersResp.meta.status !== 200) {
                    throw new Error(`Error encountered when calling getCustomQueryResultsByName. ${customQueryProvidersResp.meta.statusMsg}.`)
                }
                if (!customQueryProvidersData) {
                    throw new Error(`Data was not be returned when calling getCustomQueryResultsByName.`)
                }

                if (customQueryProvidersLength > 0 && providersFound === false) {
                    providersFound = true
                }


                // STEP 1B - Iterate through expired providers sending an email to the appropriate contact.
                //proveider es el objecto con la data
                for (let provider of customQueryProvidersData) {
                    try {
                        // Values to update Personal Liability Insurance with when calling postFormRevision.
                        let FormTemplateID = provider.revisionID;
                        let RevisionID = provider.dhid;
                        let CurrentRevisionGUID = FormTemplateID
                            //  let pdfBuffer = await vvClient.forms.getFormInstancePDF(CurrentRevisionGUID, RevisionID);

                        //let buff = new Buffer(pdfBuffer);
                        //let base64data = buff.toString('base64');

                        let formUpdateObj = {
                                'Correo_envio': 'false'
                            }
                            // STEP 1D - Update Personal Liability Insurance form record to show that the email notification has been sent.

                        //MACISU::: postFormResp actualiza check apra no enviar de nuevo el email

                        let postFormResp = await vvClient.forms.postFormRevision(null, formUpdateObj, PersonalLiabilityInsuranceTemplateID, provider['dhid'])
                        if (postFormResp.meta.status !== 201) {
                            throw new Error(`An error was encountered when attempting to update the ${PersonalLiabilityInsuranceTemplateID}: ${provider['form ID']} form. ${postFormResp.hasOwnProperty('meta') ? postFormResp.meta.statusMsg : postFormResp.message}`)
                        }
                        let token;
                        try {
                            //////////////////////////////////////////////////////////////
                            //1 - GET TOKEN
                            token = await GetToken('CCMEXT', 'ccmext$', 'password', 'https://hmws01.azurewebsites.net/ccm-security-externa/oauth/token', 'proceso-001', '123', 'password', 'application/x-www-form-urlencoded');
                            //////////////////////////////////////////////////////////////
                            //2 - SEND EMAIL WITH VALID TOKEN
                            var urlEmail = 'https://hmws01.azurewebsites.net/ccm-apicorreo-externa/appemail-v1/sendMail';
                            var jsontext = {
                                "fromName": "poc",
                                "fromEmail": "poc@intelidata.cl",
                                "subject": "Olá " + provider.nome_txt,
                                "text": "Olá " + provider.nome_txt,
                                "html": "<html><body>" +
                                    "<table  cellspacing=0 cellpadding=0>" +
                                    "<tr><td bgcolor=\"white\">" +
                                    "<img alt \"Mapfre\" src=data:image/jpg;base64," +
                                    "/9j/4AAQSkZJRgABAQEAYABgAAD/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAEAAAAAAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwMDAwYEBAMFBwYHBwcGBwcICQsJCAgKCAcHCg0KCgsMDAwMBwkODw0MDgsMDAz/2wBDAQICAgMDAwYDAwYMCAcIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAz/wAARCAA2BfADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD5ISFNo+UflT/KX+4v5UifcH0pa/k27uf6+WXYPKX+4v5UeUv9xfyooo17hp2E8tf7q/lR5a/3V/Kloou97i929hPLX+6v5Unlj+6v5U6ij3u4rwE8tf7q/lR5a/3V/KloqveCPI9hPLX+6v5Unlj+6v5U4HLf/WoqfeC8GN8sf3V/Kl8tf7q/lSg5oqveQc0BPLX+6v5UvlL/AHF/KigjbS9/uHNDYPKX+4v5UeUv9xfyooo9/uHNDcQRqD91fypaKKgrYKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAET7g+lLknorMScBVGSx7AD1pE+4PpW98Lrq3sPij4Znuiq2sOsWckzOMqqCdCSR6Ada2px5qii+rRz4ys6VCdSKu4pv7kdrpXwxtdG1ibw5Z+ENS+IHjC1iD6pFDPNFZaS+CWgHk4d3X7rOzhNwZVUkZOH4z8GaZqHhy+1rQrPUtIl0a4S21vQ79zJNphkJWOVHYB2iLDYQ43oxUEtuBr2D4ea54V8SPefDnxRr2saHHcT3smsW9rpWXfUre7mumuvtPnLktbo0AUrwHGOuaxfHfxX0/4wSeJtYt7+41KS28PalHfXkum/YALWa4thp9pgvIXMUuArEglVx2r7KtgcP7Cya220vt3300ufheX8Q5h/aScoy3V278rTaWz0SetreR2v/BHv9j/wX+2n+0P4g8N+Ora+utL03QTqEC2l49q4lE8ceSyckbXbitv/AILH/wDBO3RP2GPiF4VvPBMGoDwh4ptnt44bi4e6livojkrvbJIdGUqPVWrtv+DckZ/bH8Xf9io3/pVDX6XfE7SfAn7X/wAVdY+HPiC1L6l8J9Y0XxQqPg+YWBmhcZ/gJSSNh6D3r6bI8hwuOyOMZJKbbtK2uj/yufl/H3iBmmQ8fVKtKcpUIRjeCfu2cUr22vdp3Pk3wN/wQu+Ffhr9kKHXPGFlrV347t/Dr6jqEsGqzQQrdCFpNojDYAQ4X3289a+If+CQX7Gmh/twftJXOi+Lobyfwzo+iPqN4trcNbu8rOiRDevIGS5x321+06/G/S/2g/2SPFnijRd39l3FnrNlbM3/AC2W2ee3Mg9mMRYexFfFX/BtP8I/7I+B/jrxxNF+81/UYdKtnI58q2i3Nj2Mkzf9816WMyHCSzDC06cFyWbem6SVr99T5bJPELN6fDmb4jF15e1lKEYXk7xcm78vayXTsd9o/wDwRL/Zl8Xa14m0fS7LxK+q+GZEtb5f7euD9mlkgWaPI3c/I6GvzZ/YG/ZS0X40f8FALH4V+Ore8m02G61Ozvore4a2kMlqsuMOuCPmjB96/Sv/AIJpXnxNP7fH7RF94u8HeJtD8N+NL8ajpd5qNo8UL/ZZWtolViMZa3MZHsleL+EvhGvwf/4OOjDFD5dn4igutet+MA+fYuJMf9tUkrPNMqwtWWGr06aivacrVrXTdlf5L8Tp4T4wzTC0szy+vi5VG8PzwlzN8slFN2d9Gm7adit+1d+w5+yx+yV+0R8NvAOteDvHl5/wsWUQw6ha+IZmWyYzxwLvQsCRukGduSB2rm/20/8AgkB4L/Z8/am+DMGhyarN8P8A4ieI4fD+pWE92zz2shXdlJ/vYkRX68qV44PH1R/wUt/af+Bn7NH7SXw71n4leCdX8R+L9HspdQ8PXtpCJY7AeYFOVaVVL7wGGVOMAgg18pfEz/gp7/w37/wUA+Aul6Lpd3o3g/w34utriJbth9ov7l8r5jquQiquQq5J5Y55FVmVDKqdSWHmo8/NHlSVmtr3731OfhjH8XYijDMcNOr7JUqjnOUm4vSVnG70a0Wmuh6H+21+wL+yL+wXofh++8ZaD49uI/EdxLa2osNWuJiGjRXbd84wMEYr5D+P19+yn4j8DwWPwt0Xx5Y+LbrU7KGKXVLuZrfyGnVZwQzEbthbBx1r9Nv+CxPjz4H+BPCHgVvjZ4P1fxdZ3V/cLpKWDMGtZREpkZtssfBUgd+lfmz8efix+y34u8IWFl8Kfhx4i8N+MG1vT3t768ZzEkQuUMqndO4yVyB8v5VhnmHw1Gs6MOSKtty+9qunr0PQ4DzDM8XhIYyu8TUld++p/u9H1Tey6n1l+3h/wTV/Zo/YU+A0fjvVPBvjTXLdtQt9Pa1tfEc0cmZt3zAs2OMGuJ/bO/4JTfCLT/8AgnvJ8afhTJr+jNa6RF4jWHUryS5W8tZFRjEyuco6q2QQeowcg19xf8FTPGPwr8D/ALK0N98ZPDuoeKPB/wDbFmn2KyVjJ9p+YxOQsiEquGyN3foa8h/4LBx618TP+CW6618L9W02x8Ax6bb6jqdlFb7G1DSCkZjSFukaplWZMfMq7cjGD6+YZTglGtFU4u0LpJLmT11v/Wx8bw7xdncq2DnLE1E5VuVylJuDV17tn11f3o85H/BK/wDZr+GH7Dek/Fzxlo3i6aG38M2Wsar9i1i43u0sUZcogYD7z9B0FfMet+I/2FpNEvv7P8M/FRb4wOLZpL24KLJtOwt+86bsZr9MvFWteCvDH/BJHS774haVd654Lt/A2mNq1hbZ866i8iAbVwynO4r/ABDpX5t698eP2HbjQ76PT/g/4whvpLeRLaVpJcRylSFY/wCldA2DXm5vhMNQjBUlTjeKfvR19T6Tg3OMyx9WtUxU8TVcalk4TtFLs7v+kfD1uGEK7/v4G760+mwBhCoc5fAyfenV+Kz+Jn920f4cQoooqTUKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooARPuD6UOu9CCNwIwR60J9wfSlqtmTKN1ZncT+OvD3xBtY28WWusW+twwpAdY0jy5Hv1QBV+0QSMoMgQBfNVwWCjcpPNU/GXj3T7jw8PD/hvTZtK0IXIurh7qYTXuqyqCI3ncAKFRWbZGo2qWY5YnNcnRXZLMKko8rtfq+rPn6PDOFpVva3k0ndRb0T6WXl07H0h/wTC/bi0n9gj43614r1nQtU1+31TRm0xILCSNJEczRybyXIGMIRxzzXXfGX/gqzqXiD9sbxz8UPA+n6poEHjTwh/wAIw9ndToJYXEZWO5yhILRudy456+tfINFelh+I8bQw0cLSlaMXdd7+vzPncy8MckzDNamb4qm5VKkVFpv3bK1tNuiP0C/ZM/4LK+Gf2df2FbL4RX3g3xJqWoWen31k2oW9xAIGNw8zK2Gbfx5ozx2NR/sgf8FkvDn7In7DFp8MNJ8HeIZPE1nYXajVkmgW3a9nMjLNgtv2qzL2z8nSvgGiuyHGOYQtZr3Y8q06af5Hg1vBHhur7RThK1SaqSXM7XV/w1eh9R/snf8ABWD4q/BD476D4i8YeNfGnjjw3Z+Yuo6RPfhxeq8TKCA2F3K5VgSe1eu/Ez/gsD4J8b/t4/Dn402vgfxNbHwfpN9pV/ZSTW3m3yzKfJKMH2/IWfOezcV+f9Gaxo8WZjTpqnzcyTUtdXdWa/I7sd4O8N4jE/Wo0uRuDg1F8qcWmnoutnvufT3/AAVG/b20j/goB8T/AAz4g0fQNW8Pw6DpklhJDfyRu8jNKJNylCRjtzXjH7NXxWt/gX+0J4L8aXVrPfWvhfVodSlt4GVZJljbJVS3AJ964iivMxGbV8Ri/rs3790/mtvyPqsr4Py/AZL/AGFQT9hyyjZvW0r31+Z9kf8ABVD/AIKd6D/wUI8NeDbHR/C+ueHX8MXlxcyvfywuJ1kjVAF8tjyMc5r5B0XUBpWuWF2VLraXUVwyjqwR1Yge5AxVWinj82xGMxP1uq/e0/Anh3g3Lslyp5Rgk/Ze9u7v3t9T72/4KU/8FgvDX7dX7Na+B9I8H+ItBu11W11D7TfTQNFsh3ZGEYnJ3D2qtr3/AAV08Nav/wAEy3+A6+D/ABDHq7eFk8Pf2oZ4PsokChfM27t+3j0zXwlRXqy4wzB1JVbq8o8r06f0z4+j4L8PU8HSwSjLlp1PaR9535rJavqtFofpt4W/4LlfDGb9mDRvhn4u+FPiPxJpVnodro+oQSTWxt70QxIh+UvnaWQEZ9q8x8Q/t1/sl6hoF9BZ/syPa3lxbSJBMY7T9y7KQjff7MQfwr4Xoq6nGGNqpKoouytrFM5cN4H5Dh6rnh51IXfM1GpJK/omNt0aOFQx3MAAT6mnUUV8rLVn7JCPLHlQUUUVJQUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAKvyj6Uu3nFFFaWIuw284oVd1FFBYBcijb8uaKKCLsCuBSEbTRRQWDDaaXb82KKKCLsRRuNAG40UUFhjil2/LmiigAK4FDLtoooIuG3nFG3nFFFAXYmP0oooqGVHYKKKKQwooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9k=> " +
                                    //"width=120 height=60>" +
                                    "</td></tr>" +
                                    "<tr><td><h1>Olá <b>" + provider.nome_txt + "<br/><br/>" + "</b></h1></td></tr>" +
                                    "<tr><td><h2>Segue sua proposta do Seguro de Vida em Grupo MAPFRE para atualização dos dados e inclusão dos beneficiários.</h2><br /><br /></td></tr>" +
                                    "<tr><td><h2>Acesse o link abaixo para realizar o preenchimento dos dados.</h2><br /><br /></td></tr>" +
                                    "<tr><td><center>" + "<a href='" + provider.body + "'>" +
                                    "<img alt=\"Preencher\" src=data:image/jpg;base64," +
                                    "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>" +
                                    //"width=150 height=70> </a>" +
                                    "</a></center></td></tr>" +
                                    "<tr><td><h1><b>Att.</b><br/><br /><br /></td></tr>" +
                                    "<tr><td><h1><b>MAPFRE Seguros<br /></b><br /><br /></h1></td></tr>" +
                                    "<tr><td width=8%;font-size:12.0pt;><center><b><h3>" + "MAPFRE VIDA S.A - CNPJ 54.484.753/0001-49 - Código SUSEP Nº 0566-5 " + "</h3></b></center></td></tr>" +
                                    "</table>" +
                                    "<table  cellspacing=0 cellpadding=0>" +
                                    "<tr><td width=8%;font-size:10.0pt;><center>Av. das Nações Unidas, 14.261 – 20º andar • Vila Gertrudes • São Paulo • SP • Brasil • 04794-000</center></td></tr>" +
                                    "<tr><td style width=8%;font-size:10.0pt;><center>SAC 24 h 0800 775 4545 - SAC Deficiente Auditivo ou de Fala 24 h 0800 775 5045 - Ouvidoria 0800 775 1079. Ouvidoria Deficientes Auditivos ou</center></td></tr>" +
                                    "<tr><td width=8%;font-size:10.0pt;><center>de Fala 0800 962 7373 - Atendimento de segunda a sexta-feira, das 8h às 20h (exceto Feriados).  A Ouvidoria poderá ser acionada para atuar na</center></td></tr>" +
                                    "<tr><td width=8%;font-size:10.0pt;><center>defesa dos direitos dos consumidores, para prevenir, esclarecer e solucionar conflitos não atendidos pelos canais de atendimento habituais.</center></td></tr>" +
                                    "</table>" +
                                    "</body>" +
                                    "</html>",
                                "replyTo": {
                                    "email": "poc@intelidata.cl",
                                    "name": "poc",
                                    "type": null
                                },
                                "recipients": [{
                                    //"email": "mcifuentes@intelidata.cl",
                                    "email": provider.correo,
                                    "name": provider.nome_txt,
                                    "type": "to"
                                }],
                                "metadata": [{
                                    "key": "metadata-prueba",
                                    "value": "valor del metadata de prueba"
                                }],
                                "variables": [{
                                    "key": "${nombre}",
                                    "value": provider.nome_txt
                                }]
                            };
                            var HeaderAuthorization = "" + 'bearer ' + token;
                            var HeaderContentType = "" + 'application/json';
                            response = await sendEmailCCM(jsontext, urlEmail, HeaderAuthorization, HeaderContentType)
                            console.log("response email=>", response.body + " " + response.body.status)

                            //////////////////////////////////////////////////////////////
                            //3 - ELECTRONIC SIGN
                            var urlsign = 'https://hmws01.azurewebsites.net/ccm-apifirma-externa/applegado-v1/procesoFirma/';
                            var jsonSign = {
                                "idempresa": 2,
                                "idArea": 3,
                                "idDepartamento": 3,
                                "idUsuario": "gestorMapfre",
                                "idTipoDocumento": "3",
                                "codigoDocumentoCliente": "80308010004420000",
                                "nombreProceso": "Bien Vivir 80308010004420000",
                                "fechaVencimiento": "27-06-2021",
                                "numeroPaginas": "11",
                                "nombreDocumento": "PRO_80308010004420000.pdf",
                                "nombreCertificado": "CER_80308010004420000.pdf",
                                "informacionReporteQR": "https://www.mapfre.com.br/para-voce/",
                                "informacionReporteNombreProceso": "PROPOSTA DE SEGURO - VIDA INDIVIDUAL DOTAL",
                                "documentoPDF": "data:application/pdf;base64,JVBERi0xLjcNCiW1tbW1DQoxIDAgb2JqDQo8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFIvTGFuZyhlcy1DTykgL1N0cnVjdFRyZWVSb290IDEwIDAgUi9NYXJrSW5mbzw8L01hcmtlZCB0cnVlPj4vTWV0YWRhdGEgMjAgMCBSL1ZpZXdlclByZWZlcmVuY2VzIDIxIDAgUj4+DQplbmRvYmoNCjIgMCBvYmoNCjw8L1R5cGUvUGFnZXMvQ291bnQgMS9LaWRzWyAzIDAgUl0gPj4NCmVuZG9iag0KMyAwIG9iag0KPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9SZXNvdXJjZXM8PC9Gb250PDwvRjEgNSAwIFI+Pi9FeHRHU3RhdGU8PC9HUzcgNyAwIFIvR1M4IDggMCBSPj4vUHJvY1NldFsvUERGL1RleHQvSW1hZ2VCL0ltYWdlQy9JbWFnZUldID4+L01lZGlhQm94WyAwIDAgNjEyIDc5Ml0gL0NvbnRlbnRzIDQgMCBSL0dyb3VwPDwvVHlwZS9Hcm91cC9TL1RyYW5zcGFyZW5jeS9DUy9EZXZpY2VSR0I+Pi9UYWJzL1MvU3RydWN0UGFyZW50cyAwPj4NCmVuZG9iag0KNCAwIG9iag0KPDwvRmlsdGVyL0ZsYXRlRGVjb2RlL0xlbmd0aCAyMDQ+Pg0Kc3RyZWFtDQp4nK2OP2vDQAzF94P7Dm+8K/gsnR3/AZPB9jXE1LFLHTKUjm2mFpJ8f4jsZmiGTq0G8SQ99H6IR1RV3DfbFrReo24bnLQiR3OV7EHIpOelx/ldq8MDvrSqJ63iRwazoxTTh1YsPgKjWDmWVc7kcrl8im/zkuN4kZ84LlNxmzZavZrWRqkZmr1lNr2NEhN29g1Tp1WQjGet/gLDSeoo+wmzMNyiJ1uaATbyApGZsKjQBcv+m2SU7dMshv8j8rRyxL8R4T4IoW9wBbaDTywNCmVuZHN0cmVhbQ0KZW5kb2JqDQo1IDAgb2JqDQo8PC9UeXBlL0ZvbnQvU3VidHlwZS9UcnVlVHlwZS9OYW1lL0YxL0Jhc2VGb250L0JDREVFRStDYWxpYnJpL0VuY29kaW5nL1dpbkFuc2lFbmNvZGluZy9Gb250RGVzY3JpcHRvciA2IDAgUi9GaXJzdENoYXIgMzIvTGFzdENo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b3V0PSIiICB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iPgo8eG1wOkNyZWF0b3JUb29sPk1pY3Jvc29mdMKuIFdvcmQgMjAxOTwveG1wOkNyZWF0b3JUb29sPjx4bXA6Q3JlYXRlRGF0ZT4yMDIxLTA2LTA4VDE1OjUzOjAzLTA1OjAwPC94bXA6Q3JlYXRlRGF0ZT48eG1wOk1vZGlmeURhdGU+MjAyMS0wNi0wOFQxNTo1MzowMy0wNTowMDwveG1wOk1vZGlmeURhdGU+PC9yZGY6RGVzY3JpcHRpb24+CjxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiICB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyI+Cjx4bXBNTTpEb2N1bWVudElEPnV1aWQ6NjJGMjQ3OEYtMzc2OS00RUUyLThEODAtRTdGRTkxQTEzRTI4PC94bXBNTTpEb2N1bWVudElEPjx4bXBNTTpJbnN0YW5jZUlEPnV1aWQ6NjJGMjQ3OEYtMzc2OS00RUUyLThEODAtRTdGRTkxQTEzRTI4PC94bXBNTTpJbnN0YW5jZUlEPjwvcmRmOkRlc2NyaXB0aW9uPgogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKPC9yZGY6UkRGPjwveDp4bXBtZXRhPjw/eHBhY2tldCBlbmQ9InciPz4NCmVuZHN0cmVhbQ0KZW5kb2JqDQoyMSAwIG9iag0KPDwvRGlzcGxheURvY1RpdGxlIHRydWU+Pg0KZW5kb2JqDQoyMiAwIG9iag0KPDwvVHlwZS9YUmVmL1NpemUgMjIvV1sgMSA0IDJdIC9Sb290IDEgMCBSL0luZm8gOSAwIFIvSURbPDhGNDdGMjYyNjkzN0UyNEU4RDgwRTdGRTkxQTEzRTI4Pjw4RjQ3RjI2MjY5MzdFMjRFOEQ4MEU3RkU5MUExM0UyOD5dIC9GaWx0ZXIvRmxhdGVEZWNvZGUvTGVuZ3RoIDg2Pj4NCnN0cmVhbQ0KeJxjYACC//8ZgaQgAwOIWgah7oEpxmdgiukPmGJeDKZYJkGo4xAKKMcE1s4EoZghFAuEYoVQjBAKqpINqI/1KVg7eyGY4uABU+nmYKq4g4EBAFhADDcNCmVuZHN0cmVhbQ0KZW5kb2JqDQp4cmVmDQowIDIzDQowMDAwMDAwMDEwIDY1NTM1IGYNCjAwMDAwMDAwMTcgMDAwMDAgbg0KMDAwMDAwMDE2NiAwMDAwMCBuDQowMDAwMDAwMjIyIDAwMDAwIG4NCjAwMDAwMDA0ODYgMDAwMDAgbg0KMDAwMDAwMDc2NCAwMDAwMCBuDQowMDAwMDAwOTMxIDAwMDAwIG4NCjAwMDAwMDExNzAgMDAwMDAgbg0KMDAwMDAwMTIyMyAwMDAwMCBuDQowMDAwMDAxMjc2IDAwMDAwIG4NCjAwMDAwMDAwMTEgNjU1MzUgZg0KMDAwMDAwMDAxMiA2NTUzNSBmDQowMDAwMDAwMDEzIDY1NTM1IGYNCjAwMDAwMDAwMTQgNjU1MzUgZg0KMDAwMDAwMDAxNSA2NTUzNSBmDQowMDAwMDAwMDE2IDY1NTM1IGYNCjAwMDAwMDAwMTcgNjU1MzUgZg0KMDAwMDAwMDAwMCA2NTUzNSBmDQowMDAwMDAxOTA1IDAwMDAwIG4NCjAwMDAwMDIwNjAgMDAwMDAgbg0KMDAwMDAyNjQyMyAwMDAwMCBuDQowMDAwMDI5NTc2IDAwMDAwIG4NCjAwMDAwMjk2MjEgMDAwMDAgbg0KdHJhaWxlcg0KPDwvU2l6ZSAyMy9Sb290IDEgMCBSL0luZm8gOSAwIFIvSURbPDhGNDdGMjYyNjkzN0UyNEU4RDgwRTdGRTkxQTEzRTI4Pjw4RjQ3RjI2MjY5MzdFMjRFOEQ4MEU3RkU5MUExM0UyOD5dID4+DQpzdGFydHhyZWYNCjI5OTA2DQolJUVPRg0KeHJlZg0KMCAwDQp0cmFpbGVyDQo8PC9TaXplIDIzL1Jvb3QgMSAwIFIvSW5mbyA5IDAgUi9JRFs8OEY0N0YyNjI2OTM3RTI0RThEODBFN0ZFOTFBMTNFMjg+PDhGNDdGMjYyNjkzN0UyNEU4RDgwRTdGRTkxQTEzRTI4Pl0gL1ByZXYgMjk5MDYvWFJlZlN0bSAyOTYyMT4+DQpzdGFydHhyZWYNCjMwNTIyDQolJUVPRg==",
                                "contactos": [{
                                    "idTipoContacto": 1,
                                    "nombreContacto": "CESAR BERNAL",
                                    "dniCliente": "1-1",
                                    "correoContacto": "cbernal@intelidata.cl",
                                    "telefonoContacto": "11- 973836269",
                                    "metadata": "[{\"key\":\"${modalidade}\",\"value\":\"ESENCIAL\"},{\"key\":\"${numero-proposta}\",\"value\":\"80308010004420000\"}]"
                                }]
                            };
                            var HeaderAuthorization = "" + 'bearer ' + token;
                            var HeaderContentType = "" + 'application/json';
                            response = await signCCM(jsonSign, urlsign, HeaderAuthorization, HeaderContentType)
                            console.log("response sign=>", response.body + " " + response.body.status)




                        } catch (err) {
                            logger.error(' (-1) Mongo error getting Token and sending Email CCM', err);
                        }

                        // STEP 1C - Send an email notification .

                        //Now Send Email

                        //{ name: TokenInsuranceProvider, value: provider['plan Provider'] },

                        //Load the email object.


                        // documentado ===============

                        //var emailObj = {};
                        //emailObj.recipients = provider['correo']; //aquien va dirigido 
                        //emailObj.ccrecipients = '';
                        //emailObj.subject = provider['asunto']; //asunto
                        //emailObj.body = provider['body']; //body 
                        // //Send email visual vault
                        // esto se debe cambiar por el envio de email vía api ccm
                        // var emailenvio = await envioPorApi(null, emailObj);
                        //var emailResult = await vvClient.email.postEmails(null, emailObj);
                        /*if (emailResult.meta['status'] === 201) {

                            outputCollection[0] = 'Success';

                            outputCollection[1] = 'Related documents found.'

                        } else {

                            throw new Error('Error Sending Emails.');

                        }*/


                    } catch (error) {
                        errorLog.push(error)
                    }
                }

                //recursiveLoops++

                // STEP 1E - If any records were processed call notifyProviders function again to check for more.
                if (customQueryProvidersLength > 0 && recursiveLoops < maxLoops) {
                    customQueryProvidersResp = ''
                    customQueryProvidersData = ''
                    resolve(notifyProviders())
                } else {
                    resolve()
                }
            } catch (error) {
                errorLog.push(error)
                resolve()
            }
        })
    }

    /****************
     BEGIN ASYNC CODE
    *****************/
    // STEP 1 - Notify all providers that their personal liability insurance is coming up for expiration.
    await notifyProviders()

}