import { useEffect, useRef, useState } from 'react'
import { Download, FileVideo, Music2, Plus, Trash2 } from 'lucide-react'

type LocalMedia = {
  id: string
  name: string
  url: string
  type: string
}

export default function LocalMediaPlayer() {
  const [media, setMedia] = useState<LocalMedia[]>([])
  const [selectedId, setSelectedId] = useState('')
  const objectUrls = useRef(new Set<string>())

  useEffect(() => () => objectUrls.current.forEach(url => URL.revokeObjectURL(url)), [])

  const selected = media.find(item => item.id === selectedId)

  function addFiles(files: FileList | null) {
    if (!files) return
    const added = Array.from(files)
      .filter(file => file.type.startsWith('audio/') || file.type.startsWith('video/'))
      .map(file => ({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        name: file.name,
        url: URL.createObjectURL(file),
        type: file.type,
      }))
    const knownIds = new Set(media.map(item => item.id))
    const unique = added.filter(item => {
      if (knownIds.has(item.id)) {
        URL.revokeObjectURL(item.url)
        return false
      }
      knownIds.add(item.id)
      objectUrls.current.add(item.url)
      return true
    })
    if (!selectedId && unique[0]) setSelectedId(unique[0].id)
    setMedia(current => [...current, ...unique])
  }

  function removeFile(id: string) {
    const removed = media.find(item => item.id === id)
    if (removed) {
      URL.revokeObjectURL(removed.url)
      objectUrls.current.delete(removed.url)
    }
    const remaining = media.filter(item => item.id !== id)
    setMedia(remaining)
    if (selectedId === id) setSelectedId(remaining[0]?.id || '')
  }

  return <section className="local-media">
    <div className="music-toolbar">
      <div><span className="eyebrow">YOUR DEVICE</span><h2>Play your media files</h2></div>
      <label className="primary-button file-picker">
        <Plus size={16} /> Add audio or video
        <input type="file" accept="audio/*,video/*" multiple onChange={event => {
          addFiles(event.currentTarget.files)
          event.currentTarget.value = ''
        }} />
      </label>
    </div>
    <p className="local-media-hint">Files stay in this browser session; they are not uploaded. Only add media you have the right to use.</p>
    {selected && <div className="local-player">
      <div className="local-player-title">{selected.type.startsWith('video/') ? <FileVideo size={18} /> : <Music2 size={18} />}<strong>{selected.name}</strong></div>
      {selected.type.startsWith('video/')
        ? <video key={selected.id} src={selected.url} controls playsInline />
        : <audio key={selected.id} src={selected.url} controls />}
      <a className="secondary-button local-download" href={selected.url} download={selected.name}><Download size={15} /> Download file</a>
    </div>}
    {media.length > 0
      ? <div className="local-file-list">{media.map(item => <div className={`local-file ${selectedId === item.id ? 'selected' : ''}`} key={item.id}>
        <button className="local-file-name" onClick={() => setSelectedId(item.id)}>{item.type.startsWith('video/') ? <FileVideo size={17} /> : <Music2 size={17} />}<span>{item.name}</span></button>
        <button className="local-file-remove" onClick={() => removeFile(item.id)} aria-label={`Remove ${item.name}`}><Trash2 size={15} /></button>
      </div>)}</div>
      : <div className="local-media-empty">Choose audio or video files from your device to play them here.</div>}
  </section>
}
