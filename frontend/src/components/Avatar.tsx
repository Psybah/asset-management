import { createAvatar } from '@dicebear/core'
import { notionists } from '@dicebear/collection'
import { cn } from '@/lib/utils'

const cache = new Map<string, string>()

/** DiceBear "Notionists" avatar — black line art, generated locally from the person's name. */
export function avatarUri(seed: string) {
  let uri = cache.get(seed)
  if (!uri) {
    uri = createAvatar(notionists, { seed, backgroundColor: ['f1f1f1'], scale: 110 }).toDataUri()
    cache.set(seed, uri)
  }
  return uri
}

export function Avatar({ name, className }: { name?: string | null; className?: string }) {
  return <img src={avatarUri(name || '?')} alt="" className={cn('size-9 shrink-0 rounded-full bg-mist object-cover', className)} />
}
