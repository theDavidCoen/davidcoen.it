const videoPlayer = document.getElementById('videoPlayer');
const playButton = document.getElementById('playButton');
const client = new WebTorrent();

playButton.addEventListener('click', () => {
	if (videoPlayer.paused) {
		videoPlayer.play();
		playButton.style.display = 'none';
	} else {
		videoPlayer.pause();
		playButton.style.display = 'block';
	}
});

const url = 'your-torrent-url-here';
client.add(url, (torrent) => {
	const videoFile = torrent.files.find(file => {
		const extension = file.name.split('.').pop().toLowerCase();
		return extension === 'mp4' || extension === 'avi' || extension === 'mkv' || extension === 'webm';
	});

	const stream = videoFile.createReadStream();
	videoPlayer.src = URL.createObjectURL(stream);
});
