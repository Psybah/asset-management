import { createAvatar } from '@dicebear/core'
import { notionists } from '@dicebear/collection'
import { cn } from '@/lib/utils'

const INK = '#201515'
const cache = new Map<string, string>()

/** DiceBear "Notionists" avatar, generated locally, recoloured to white line art on the accent ink. */
export function avatarUri(seed: string) {
  let uri = cache.get(seed)
  if (!uri) {
    const raw = createAvatar(notionists, { seed, backgroundColor: ['ffffff'], scale: 110 }).toString()
    // Recolour outside <mask> blocks only (masks must stay white): black line art → white,
    // white fills (background, skin, clothes) → the accent ink.
    const svg = raw.split(/(<mask[\s\S]*?<\/mask>)/).map((part) => part.startsWith('<mask') ? part : part
      .replace(/fill="#000"/g, 'fill="__W__"')
      .replace(/fill="#fff(fff)?"/g, `fill="${INK}"`)
      .replace(/fill="__W__"/g, 'fill="#ffffff"')).join('')
    uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    cache.set(seed, uri)
  }
  return uri
}

export function Avatar({ name, className }: { name?: string | null; className?: string }) {
  return <img src={avatarUri(name || '?')} alt="" className={cn('size-9 shrink-0 rounded-full bg-ink object-cover', className)} />
}
