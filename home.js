(function(){
	function onScrollReveal(){
		document.querySelectorAll('.reveal').forEach(el=>{
			const rect = el.getBoundingClientRect();
			if (rect.top < window.innerHeight - 80) el.classList.add('revealed');
		});
	}
	function stickyHeader(){
		const header = document.getElementById('siteHeader');
		if (!header) return;
		window.addEventListener('scroll', ()=>{
			header.classList.toggle('sticky', window.scrollY > 20);
		});
	}
	function tabs(){
		document.querySelectorAll('.tab-btn').forEach(btn=>{
			btn.addEventListener('click', ()=>{
				document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
				document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
				btn.classList.add('active');
				document.getElementById(btn.dataset.tab).classList.add('active');
			});
		});
	}
	function carousel(){
		document.querySelectorAll('.carousel').forEach(car=>{
			const track = car.querySelector('.carousel-track');
			const items = Array.from(track.children);
			let idx = 0; let timer = null;
			function go(i){ idx = (i+items.length)%items.length; track.style.transform = `translateX(${-idx*100}%)`; }
			car.querySelector('.prev').addEventListener('click', ()=>{ go(idx-1); });
			car.querySelector('.next').addEventListener('click', ()=>{ go(idx+1); });
			const autoplay = car.dataset.autoplay === 'true';
			const interval = parseInt(car.dataset.interval||'4000',10);
			if(autoplay){ timer = setInterval(()=>go(idx+1), interval); car.addEventListener('mouseenter', ()=>clearInterval(timer)); car.addEventListener('mouseleave', ()=>{ timer=setInterval(()=>go(idx+1), interval); }); }
		});
	}
	function counters(){
		const els = document.querySelectorAll('.stat-number');
		els.forEach(el=>{
			const target = parseInt(el.dataset.target,10)||0;
			let cur = 0;
			const step = Math.ceil(target/60);
			const int = setInterval(()=>{ cur += step; if(cur>=target){ cur=target; clearInterval(int);} el.textContent = cur.toLocaleString('pt-BR'); }, 30);
		});
	}
	function accordion(){
		document.querySelectorAll('.accordion .acc-header').forEach(btn=>{
			btn.addEventListener('click', ()=>{ btn.parentElement.classList.toggle('open'); });
		});
	}
		document.addEventListener('DOMContentLoaded', ()=>{
		stickyHeader();
		onScrollReveal();
		window.addEventListener('scroll', onScrollReveal);
		tabs();
		carousel();
		counters();
		accordion();
	});
})();