/* Your Plot service worker: show local notifications while the page or PWA is open or backgrounded. */
self.addEventListener('install', event=>{self.skipWaiting();});
self.addEventListener('activate', event=>{event.waitUntil(self.clients.claim());});
self.addEventListener('message', event=>{
  const data=event.data||{};
  if(data.type==='show' && data.title){
    event.waitUntil(self.registration.showNotification(data.title,{
      body:data.body||'',
      tag:data.tag||'yp',
      data:data.data||{}
    }));
  }
});
self.addEventListener('notificationclick', event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of clients){
      if('focus' in client){await client.focus();return;}
    }
    if(self.clients.openWindow)await self.clients.openWindow('./');
  })());
});
