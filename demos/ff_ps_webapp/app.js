document.addEventListener('alpine:init', () => {

	Alpine.data('app', () => ({
		generatingImages:false,
		prompt:'',
		fireflyResults:[],
		step2Enabled:false,
		async init() {
			console.log('init done');
		},
		async generateImages() {
			this.step2Enabled = false;
			if(this.prompt.trim() === '') return;
			console.log(`Generating images for prompt: ${this.prompt}`);
			this.generatingImages = true;
			let request = await fetch('/genImage', {
				method:'post',
				body: JSON.stringify({prompt:this.prompt})
			});
			this.fireflyResults = await request.json();
			this.generatingImages = false;
			this.step2Enabled = true;
		}
	}));
});

