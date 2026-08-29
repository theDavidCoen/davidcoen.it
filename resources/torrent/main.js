let client, torrent;

function downloadTorrent() {
  client = new WebTorrent();
  const magnetURI = document.getElementById('magnet-link').value;

  client.add(magnetURI, function(torrentObj) {
    console.log('Torrent info hash:', torrentObj.infoHash);
    torrent = torrentObj;

    // Print basic info about the torrent
    const stats = document.getElementById('stats');
    stats.innerHTML = `
      <p>File size: ${formatBytes(torrent.length)}</p>
      <p>Peers: ${torrent.numPeers}</p>
      <p>Seeds: ${torrent.numSeeds}</p>
    `;

    torrent.on('download', function(bytes) {
      const progress = (torrent.progress * 100).toFixed(1);
      const speed = formatBytes(torrent.downloadSpeed) + '/s';
      const downloaded = formatBytes(torrent.downloaded);

      setProgress(progress);

      document.getElementById('progress-bar').innerHTML = `
        ${progress}% downloaded (${downloaded} of ${formatBytes(torrent.length)})
        at ${speed}
      `;
    });

    torrent.on('done', function() {
      console.log('Torrent download finished');
      torrent.files.forEach(function(file) {
        const filename = file.name;
        file.getBlob(function(err, blob) {
          saveAs(blob, filename);
        });
      });
    });

    document.querySelector('button[onclick="stopDownload()"]').disabled = false;
  });
}

function setProgress(progress) {
  const progressBar = document.getElementById('progress');
  const percent = (progress * 1).toFixed(1);
  progressBar.style.width = `${percent}%`;
  const hue = 240 * progress / 100;
  progressBar.style.backgroundColor = `hsl(${hue}, 100%, 50%)`;
  progressBar.innerHTML = `${percent}%`;
}

function stopDownload() {
  if (torrent) {
    torrent.destroy(function() {
      console.log('Torrent download stopped');
    });
    torrent = null;
  }
  const stats = document.getElementById('stats');
  stats.innerHTML = '';
  document.getElementById('progress-bar').innerHTML = '';
  document.querySelector('button[onclick="stopDownload()"]').disabled = true;
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
