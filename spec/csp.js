// JS for CSP Markdown
// 2009 Martin Hunt

// add a link to the top of the page
;(function(){
var doc=document;
if(!window.addEventListener){return;}
with(doc.getElementById('wrapper').appendChild(doc.createElement('a'))){className="fixedLink";id="topLink";href="#top";innerHTML="\u25B2 top";}
function S1(){document.getElementById('topLink').style.display=pageYOffset?'block':'none'};
S1();addEventListener('scroll',S1,false)	
})();

// make all <code> elements link to their corresponding sections
// doesn't link <code> elements that refer to their own section
// links <code> elements based on name, ignoring underscores in the elements and trailing 's' in headers
;(function(){
var doc=document;
if(!doc.getElementsByTagName){return;}
var links={};
for(var i=2;i<6;++i){b(doc.getElementsByTagName('h'+i))}
var code=doc.getElementsByTagName('code');
for(var i=0,el;el=code[i];++i){
	var c=el.innerHTML.toLowerCase();
	if(c in links){
		var d=el.parentNode;
		while((d=d.previousSibling)&&(!d.tagName||d.tagName.charAt(0)!='H')){}
		links[c]!=d.id&&(el.innerHTML='<a href="#'+links[c]+'>'+el.innerHTML+'</a>')
	}
}
function b(h){
	for(var i=0,a;a=h[i];++i){
		var result=a.id&&a.id.match(/\d+\-(.*)/);
		if(result) links[result[1]]=links[result[1].replace(' ','_')]=links[result[1]+'s']=a.id;
	}
}
})();

// fixes the position of the TOC to the left side
;(function(){
var doc=document;
if(!window.addEventListener){return;}
var toc=document.getElementsByTagName('div');
var i=0;while(toc[i].className!='toc'){++i};toc=toc[i];
with(doc.getElementById('wrapper').appendChild(doc.createElement('a'))){className="fixedLink";id="fixedLink";href="#";innerHTML="static toc";onclick=function(){
	var wrapper=doc.getElementById('wrapper');
	var e1=wrapper.appendChild(doc.createElement('div'));
	with(e1.style){position='fixed';left='0px';top='0px';background='#EEE';height='100%';width='20em';overflow='auto'}
	e1.appendChild(toc);
	with(toc.style){padding='0px 10px 10px 10px';position='static';}
	with(wrapper.style){marginLeft='24em'}
	this.parentNode.removeChild(this);
	return false;
}}
})();