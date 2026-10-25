import {validState} from './model.js?v=5';
import {mergeStates,sameState} from './sync-model.js?v=5';

export function validCloudConfig(config) {
  try {
    const u=new URL(config.url);
    if(u.protocol!=='https:'||!/^[-a-z0-9]+\.supabase\.co$/.test(u.hostname)||u.username||u.password||u.port||u.search||u.hash||(u.pathname!=='/'&&u.pathname!==''))return false;
    if(typeof config.key!=='string'||!config.key)return false;
    if(config.key.startsWith('sb_publishable_'))return true;
    const payload=JSON.parse(atob(config.key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    return payload.role==='anon';
  }catch{return false;}
}

export class CloudClient {
  constructor(config,{fetcher=fetch,storage=localStorage}={}) {
    if(!validCloudConfig(config))throw Error('请填写 Supabase 项目 HTTPS 地址和 publishable/anon 公钥；不要填写私钥');
    this.config={url:config.url.replace(/\/$/,''),key:config.key};this.fetcher=(...args)=>fetcher(...args);this.storage=storage;
    this.sessionKey='daybyday.session.'+new URL(config.url).hostname;
    try { const saved=JSON.parse(storage.getItem(this.sessionKey));this.session=saved?.user?.id&&saved.refresh_token?saved:null; }catch{this.session=null;}
  }
  remember(session) {
    this.session=session;
    if(session)this.storage.setItem(this.sessionKey,JSON.stringify(session));else this.storage.removeItem(this.sessionKey);
  }
  async auth(path,body) {
    const generation=this.authGeneration||0;
    const response=await this.fetcher(this.config.url+'/auth/v1/'+path,{method:'POST',headers:{apikey:this.config.key,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await response.json();
    if(!response.ok) {
      if(data.code==='email_not_confirmed')throw Error('请先到邮箱确认注册，再登录');
      if(data.code==='invalid_credentials'||data.error_code==='invalid_credentials')throw Error('邮箱或密码不正确');
      if(response.status===429)throw Error('操作过于频繁，请稍后再试');
      throw Error('账号操作失败，请检查项目配置、邮箱和密码');
    }
    if(generation!==(this.authGeneration||0))throw Error('账号已退出，请重新登录');
    if(data.access_token)this.remember({...data,expires_at:Math.floor(Date.now()/1000)+data.expires_in});
    return data;
  }
  signIn(email,password) {return this.auth('token?grant_type=password',{email,password});}
  signUp(email,password) {return this.auth('signup',{email,password});}
  async token() {
    if(!this.session)throw Error('请先登录');
    if(!this.session.expires_at||this.session.expires_at<Date.now()/1000+60) {
      this.refreshing ||= this.auth('token?grant_type=refresh_token',{refresh_token:this.session.refresh_token}).finally(()=>this.refreshing=null);
      await this.refreshing;
    }
    return this.session.access_token;
  }
  async request(method,path,body) {
    const token=await this.token();
    const r=await this.fetcher(this.config.url+'/rest/v1/'+path,{method,headers:{apikey:this.config.key,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'},...(body?{body:JSON.stringify(body)}:{})});
    if(r.status===409)return {conflict:true};
    if(!r.ok) {
      if(r.status===401)throw Error('登录已过期，请重新登录；本地数据已保留');
      if(r.status===404)throw Error('云端数据表尚未创建，请先执行数据库配置 SQL');
      if(r.status===403)throw Error('云端权限不足，请检查数据库行级权限配置');
      throw Error('同步失败，请检查网络和云端配置；本地数据已保留');
    }
    return r.json();
  }
  async exchange(local) {
    if(!validState(local))throw Error('本地数据格式错误，已停止同步');
    const owner=this.session?.user?.id;if(!owner)throw Error('请先登录');
    const path='planner_states?user_id=eq.'+encodeURIComponent(owner);
    for(let attempt=0;attempt<5;attempt++) {
      const rows=await this.request('GET',path+'&select=payload,revision');
      if(!rows.length) {
        const created=await this.request('POST','planner_states',{user_id:owner,payload:local,revision:1});
        if(created.conflict)continue;
        return created[0].payload;
      }
      const row=rows[0];
      if(!validState(row.payload))throw Error('云端数据格式错误，本地记录已保留');
      const merged=mergeStates(local,row.payload);
      if(sameState(merged,row.payload))return merged;
      const updated=await this.request('PATCH',path+'&revision=eq.'+row.revision,{payload:merged,revision:row.revision+1});
      if(updated.conflict||!updated.length)continue;
      return updated[0].payload;
    }
    throw Error('另一设备正在更新，请稍后重试；本地数据已保留');
  }
  async signOut() {
    this.authGeneration=(this.authGeneration||0)+1;
    const token=this.session?.access_token;
    this.remember(null);
    if(token)try{await this.fetcher(this.config.url+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:this.config.key,Authorization:'Bearer '+token}});}catch{}
  }
}
