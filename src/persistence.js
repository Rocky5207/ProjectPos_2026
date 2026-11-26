class Store {
  async open() {
    this.db=await new Promise((resolve,reject)=>{
      const req=indexedDB.open('noon-counter-v1',1);
      req.onupgradeneeded=()=>req.result.createObjectStore('counter');
      req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
    });
    return this.run();
  }
  run(change,version) {
    return new Promise((resolve,reject)=>{
      const tx=this.db.transaction('counter','readwrite');
      const store=tx.objectStore('counter');
      const read=store.get('single-till');
      let state,result,problem;
      read.onsuccess=()=>{
        try {
          state=read.result||initialState(dayOf());
          if(change) {
            if(state.version!==version) throw Error('This counter changed in another tab. Review and retry.');
            result=change(new Register(state)); state.version++;
          }
          if(change||!read.result) store.put(state,'single-till');
        } catch(e) { problem=e; tx.abort(); }
      };
      tx.oncomplete=()=>resolve({state,result});
      tx.onabort=()=>reject(problem||tx.error||Error('Storage is unavailable.'));
      tx.onerror=()=>{};
    });
  }
}
