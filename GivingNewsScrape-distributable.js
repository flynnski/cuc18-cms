/*
* ************************************************************************************************************************
* 
* Giving Site News => Cascade importer
* by Sean Flynn - The College of William and Mary
* sflynn@wm.edu / sean.flynn@gmail.com
* v1.0 - November 14, 2017: Initial release & import run
*
* Notes:
*    Requires CasperJS (http://casperjs.org/); this was written against v. 1.1.4 for Mac.
*    Install CasperJS with Homebrew (https://brew.sh/); script is ready to run.
*    Be sure to use *your* username and password, not a series of asterisks.
*
* ************************************************************************************************************************
*/

var utils = require('utils');
var fs = require('fs');

var links = [];
var stories = [];
var casper = require('casper').create();
var baseURL = "https://giving.wm.edu"
var i = 0; // link counter
var j = 0; // news story counter for ... scope reasons?


// prints console errors in casper.evaluate() statements
casper.on("page.error", function(msg, trace) {
     this.echo("Error: " + msg, "ERROR");
});

// uncomment for more verbose error printing

//casper.on("resource.error", function(resourceError) {
//    this.echo("Resource error: " + "Error code: "+resourceError.errorCode+" ErrorString: "+resourceError.errorString+" url: "+resourceError.url+" id: "+resourceError.id, "ERROR");
//});

//casper.on('remote.message', function(message) {
//    this.echo('remote message caught: ' + message);
//});



function getLinks() {
    var links = document.querySelectorAll('.news-item-content.col-xs-12 > h4 > a');
    return Array.prototype.map.call(links, function(e) {
        return e.getAttribute('href');
    });
}

casper.start('https://giving.wm.edu/about-us/news.html', function() {
   // Wait for the page to be loaded
   this.waitForSelector('.news-listing');
   links = this.evaluate(getLinks);
});

casper.then(function(){
    // behold the magic of callbacks
    this.each(links, function(){
        this.thenOpen(baseURL + links[i], function(){
           var curNewsStory = "";
           this.echo(this.getTitle()); 
           this.echo(this.getCurrentUrl()); 
            
           // start .evaluate()ing.
           curNewsStory = this.evaluate(function(){
               
            // lock up the entire JS engine to wait for the page to load.
            // don't do this at home, kids.
            // seriously, casperJS has a whole waitForSelector().then() function I SHOULD be using
            function sleep(milliseconds) {
              var start = new Date().getTime();
              for (var r = 0; r < 1e7; r++) {
                if ((new Date().getTime() - start) > milliseconds){
                  break;
                }
              }
            }
            sleep(3000);               
               
            var bylineArray = [];
            var curNewsStoryStruct = 
            {
                "title": "",
                "byline": "",
                "date": "",
                "blurb": "",
                "body": "",
                "filename": ""
            };

            // get the path from the URL
            curNewsStoryStruct.filename = location.pathname.substring(location.pathname.lastIndexOf("/") + 1, location.pathname.length-5);
            
            // this fails & kills the process if the page hasn't loaded in time.
            // robustify this by rewriting it all within a casper.waitForSelector().
            // or at LEAST check to see if it's null, and print the URL and maybe try again if it is
            // anything but what I did here

            curNewsStoryStruct.title = document.querySelector('h2').innerHTML.trim();
            curNewsStoryStruct.date = document.querySelector('.date').innerHTML.trim();

            // remove excess spaces, span tags and periods so we can parse the date.
            curNewsStoryStruct.date = curNewsStoryStruct.date.replace(/\s{2,}/gi, " ");
            curNewsStoryStruct.date = curNewsStoryStruct.date.replace(/<\/?span[^>]*>/gi, "");
            curNewsStoryStruct.date = curNewsStoryStruct.date.replace(/\./gi, "");

            // get the blurb (left column)
            curNewsStoryStruct.blurb = document.querySelector('.overlay>.text-center')
               
            // some stories don't have blurbs
            if(curNewsStoryStruct.blurb){
                curNewsStoryStruct.blurb = curNewsStoryStruct.blurb.innerHTML.trim();
            }
               
            // get the news story itself
            curNewsStoryStruct.body = document.querySelector('.news-content.col-xs-12').innerHTML.trim();
            curNewsStoryStruct.body = curNewsStoryStruct.body.replace(/<\/?span[^>]*>/gi, "");
            //remove the date from the body
            curNewsStoryStruct.body = curNewsStoryStruct.body.replace(/<div\s*class=\"date\">(?:[\s\S]*?)<\/div>/gi," ");
            //remove excess divs
            curNewsStoryStruct.body = curNewsStoryStruct.body.replace(/<\/?div[^>]*>/gi,"<br />");
            // fix the start of the story
            curNewsStoryStruct.body = curNewsStoryStruct.body.replace(/^\s*<br\s*\/>\s*<br\s*\/>\s*/gi,"");
            // fix the end of the story
            curNewsStoryStruct.body = curNewsStoryStruct.body.replace(/\s*<br\s*\/>\s*<br\s*\/>\s*$/gi,"");
            // script tags?! in MY news stories?
            curNewsStoryStruct.body = curNewsStoryStruct.body.replace(/<script[^>]*>(?:[\s\S]*?)<\/script>/gi,"");
            // spaces
            curNewsStoryStruct.body = curNewsStoryStruct.body.replace(/\s{2,}/gi," ");
            // one more thing?
            curNewsStoryStruct.body = curNewsStoryStruct.body.replace(/<\/p>\s*<br \/>\n<br \/>\n<p>/gi,"</p><p>");

            // fetch the byline - we need regex to do this! yay! regex!
            bylineArray = curNewsStoryStruct.body.match(/<p><i>\s*(?:\&nbsp;)?\s*By\s*(.*?)(?:\&nbsp;)?\s*<\/i><\/p>/i);

            // some stories might not have matchable bylines. *sigh*
            if(bylineArray){
                //first, ditch the duplicate byline in the body
                curNewsStoryStruct.body = curNewsStoryStruct.body.replace(/<p><i>\s*(?:\&nbsp;)?\s*By\s*(?:.*?)(?:\&nbsp;)?\s*<\/i><\/p>/gi, '');

                if (bylineArray[1].trim() != 'staff' 
                    && bylineArray[1].trim() != 'University Advancement staff'
                    && bylineArray[1].trim() != 'University Advancement'){
                    curNewsStoryStruct.byline = bylineArray[1].trim();
                }
                else
                {
                    curNewsStoryStruct.byline = "Advancement Staff";
                }
            }
            else
            {
                curNewsStoryStruct.byline = "Advancement Staff";
            }

            // BODY FIXINS
            // change smart quotes, etc into appropriate HTML entities in body
            curNewsStoryStruct.body = curNewsStoryStruct.body.replace(/[\u00A0-\u9999]/gim, function(i) 
                                                                        {  return '&#'+i.charCodeAt(0)+';'; });
            // remove nbsps
            curNewsStoryStruct.body = curNewsStoryStruct.body.replace(/&nbsp;/gi, ' ');
               
            // TITLE FIXINS
            // change smart quotes, etc into appropriate HTML entities in title
            curNewsStoryStruct.title = curNewsStoryStruct.title.replace(/[\u00A0-\u9999]/gim, function(i) 
                                                                        {  return '&#'+i.charCodeAt(0)+';'; });
            // cascade doesn't render ampersands in titles?
            curNewsStoryStruct.title = curNewsStoryStruct.title.replace(/\&amp;/gi, '&');

            // some of these reportedly ended up in titles
            curNewsStoryStruct.title = curNewsStoryStruct.title.replace(/\%20/gi, ' ');
               
            //BYLINE FIXIN            
            // entity-fy the byline
            curNewsStoryStruct.byline = curNewsStoryStruct.byline.replace(/[\u00A0-\u9999]/gim, function(i) 
                                                                        {  return '&#'+i.charCodeAt(0)+';'; });

            return (curNewsStoryStruct);
           }); // END EVALUATE
            
            
            // OK, so our dates don't have years
            // we counted which stories were in which year.
            // 2017: 0-38 
            // 2016: 39-91
            // 2015: 92-end
            
            this.echo(j); // need this instead of i bc scope?
                    
            if (j > 91) {
                var year = "2015";
            }
            else if (j > 38){
                var year = "2016"
            }
            else {
                var year = "2017";
            }
                
            curNewsStory.date = curNewsStory.date + ", " + year;
            var jsDate = new Date(curNewsStory.date);
            curNewsStory.date = jsDate;
            
            // print the struct to screen.
            utils.dump(curNewsStory);
            
            // uncomment to (over) write to many files
            // fs.write(curNewsStory.filename+'.json', JSON.stringify(curNewsStory), 'w');

            // BEGIN POST REQUEST
            // Note: The asset object is really complicated. Instead of relying on the API documentatino
            // (which is fairly sparse), READ an object instead.
            // Example:
            // https://cascade.wm.edu/api/v1/read/page/Advancement/advancement.wm.edu/news/2017/hewlett-foundation-aiddata-grant?u=******&p=******
            
            // Please remember to use your own Cascade username password
            // and LAST BUT NOT LEAST: There is a 7-year old Cascade bug (CSI-136) that prevents the
            // following POST request from working. The workaround: we had to allow the user to _bypass all permissions checks_
            // to get it to work. 
            // (http://help-archives.hannonhill.com/discussions/web-services/46-your-role-requires-that-you-specify-a-workflowconfiguration-for-this-operation-error-when-creating-assets-in-folders-with-web-services)
            
			/* 

			The problem was with the enforcement of workflows within Web Services.

			We have all folders set to require / inherit workflows by default – so technically workflows are "turned on" for every folder.

			But then we give anyone at the Publisher or Manager level the ability to bypass workflows. So, if a folder has a workflow, you can bypass it... and if a folder doesn't have a workflow assigned, you can just submit without having to bypass anything.

			Which all works great in Cascade.

			But in Web Services there is a bug.

			If a folder has workflows turned on, then you must choose a workflow. If there is no workflow assigned, then you obviously can't choose one. And if you don't choose one, Web Services complains – without first checking to see if you are allowed to bypass workflows.


			The original (quick-and-dirty) solution was to enable this setting:
			Bypass all permissions checks
			Which is equivalent to making you a system administrator for all of Cascade. So that's actually what I did the first few times – temporarily gave you the Global role of Administrator.


			But after getting the (above) details from Tim @ Hannon Hill... we turned off workflows for the folder(s) in question – and then I believe Web Services worked for you with Manager permissions.

			*/
			
			
            casper.open('https://cascade.wm.edu/api/v1/create?u=******&p=******', {
                method: 'post',
                headers: {
                   'Content-Type': 'application/json; charset=utf-8'
                }, 
                data:   {
                      'asset': {
                        'page': {
                          'contentTypeId': '649deb210a0000065fa0893b04323621',
                          'contentTypePath': 'advancement.wm.edu/News Story',
                          'name': curNewsStory.filename,
                          'parentFolderPath': '/advancement.wm.edu/news/' + year,
                          'siteName': 'Advancement',
                          'structuredData': {
                              'structuredDataNodes':
                                [{
                                'type': 'group',
                                'identifier': 'content',
                                'structuredDataNodes': [
                                    {
                                        'type': 'text',
                                        'identifier': 'datePublished',
                                        'text': curNewsStory.date.getTime(),
                                        'recycled': false
                                    },
                                    {
                                        'type':'text',
                                        'identifier':'pageText',
                                        'text': curNewsStory.body,
                                        'recycled': false
                                    }
                                ]
                            }]
                          },
                          'metadata': {
                            'author':  curNewsStory.byline,
                            'summary': curNewsStory.blurb,
                            'title':  curNewsStory.title,
                            'dynamicFields':[
                            {
                                'name': 'category',
                                'fieldValues': [
                                    {
                                        'value': 'Impact'
                                    },
                                    {
                                        'value': 'Alumni'
                                    }
                                ]
                            },

                            {
                                'name': 'showSiblings',
                                'fieldValues':[
                                    {
                                        'value': 'Yes'
                                    }

                                ]
                            }
                           ]
                          }
                        }
                      }
                    }
                });
            casper.then(function() {
                this.echo('POST results:');
                utils.dump(JSON.parse(this.getPageContent()));
                // increment story counter so we know what year it is
                j++;
            });            
        });
        //advance the link counter
        i++;
    });
});


casper.run(function() {
    // don't forget to leave
    casper.exit();
});
