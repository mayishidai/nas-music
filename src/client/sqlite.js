import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import { ensureDir } from '../utils/fileUtils.js';

// 确保数据库目录存在
const dbDir = './db';
ensureDir(dbDir);
const musicDB = new Database(path.join(dbDir, 'music.db'), { verbose: null });
// 歌手名称分隔符
const ARTIST_SEPARATORS = ['/', '、', ',', '，', '&', '&amp;', 'feat.', 'feat', 'ft.', 'ft', 'featuring', 'vs', 'VS'];

const util = {
  merge: (a={}, b={}) => {
    const fields = Object.keys(a).concat(Object.keys(b));
    const result = {};
    for (const field of fields) {
      result[field] = a[field] || b[field];
    }
    return result;
  },
  md5: (str) => {
    return crypto.createHash('md5').update(str).digest('hex');
  },
  formatArtistNames: (artistString) => {
    if (!artistString || typeof artistString !== 'string') { return []; }
    let names = [artistString];
    for (const separator of ARTIST_SEPARATORS) {
      const newNames = [];
      for (const name of names) {
        newNames.push(...name.split(separator).map(n => n.trim()).filter(n => n));
      }
      names = newNames;
    }
    return [...new Set(names)].filter(name => name.length > 0);
  },
  normalize: (str) => {
    return str.toLowerCase().replace(/[^\w\s\u4e00-\u9fff]/g, '').replace(/ /g, '').trim();
  },
  serialize: (json) => {
    return json ? JSON.stringify(json) : null;
  },
  deserialize: (str) => {
    return str ? JSON.parse(str) : null;
  },
  /**
   * 查询条件格式化
   * 查询示例
   * { field1: 1, field2: "test2", field3: { operator: 'IN', data: [1,2,3] } }
   * { field1: { operator: 'IN', data: [1,2,3] } }
   * { field1: { operator: 'BETWEEN', data: [1,2] } }
   * { field1: { operator: 'LIKE', data: '123' } }
   * { field1: [{ operator: 'IN', data: [1,2,3] }, { operator: 'BETWEEN', data: [1,2] }] }
   */
  selectFormatOperator: (prefix='', filter) => {
    const conditions = [];
    const params = {};
    for (const [key, value] of Object.entries(filter)) {
      if(typeof value === 'object' && value.operator){
        switch (value.operator) {
          case 'SQL':
            conditions.push(`(${value.condition})`);
            Object.assign(params, value.params);
            break;
          case 'IN':
            conditions.push(`${key} IN (${value.data.map((v,i) => `@${prefix}${key}_${i}`).join(',')})`);
            value.data.forEach((v,i)=>{
              params[`${prefix}${key}_${i}`] = v;
            })
            break;
          case 'NOT IN':
            conditions.push(`${key} NOT IN (${value.data.map((v,i) => `@${prefix}${key}_${i}`).join(',')})`);
            value.data.forEach((v,i)=>{
              params[`${prefix}${key}_${i}`] = v;
            })
            break;
          case 'BETWEEN':
            conditions.push(`${key} BETWEEN @${prefix}${key}_between_0 AND @${prefix}${key}_between_1`);
            params[`${prefix}${key}_between_0`] = value.data[0];
            params[`${prefix}${key}_between_1`] = value.data[1];
            break;
          case 'NOT BETWEEN':
            conditions.push(`${key} NOT BETWEEN @${prefix}${key}_between_0 AND @${prefix}${key}_between_1`);
            params[`${prefix}${key}_between_0`] = value.data[0];
            params[`${prefix}${key}_between_1`] = value.data[1];
            break;
          case 'LIKE':
            conditions.push(`${key} LIKE @${prefix}${key}`);
            params[`${prefix}${key}`] = '%' + value.data + '%';
            break;
          case 'NOT LIKE':
            conditions.push(`${key} NOT LIKE @${prefix}${key}`);
            params[`${prefix}${key}`] = '%' + value.data + '%';
            break;
          default:
            conditions.push(`${key} ${value.operator} @${prefix}${key}`);
            params[`${prefix}${key}`] = value.data;
            break;
        }
      }else if(Array.isArray(value)){
        value.forEach((v,i)=>{
          const result = util.selectFormatOperator(`${prefix}${key}_${i}_`, v);
          conditions.push(...result.conditions);
          Object.assign(params, result.params);
        })
      }else if(typeof value === 'boolean'){
        conditions.push(`${key} = @${prefix}${key}`);
        params[`${prefix}${key}`] = value ? 1 : 0;
      }else{
        conditions.push(`${key} = @${prefix}${key}`);
        params[`${prefix}${key}`] = value;
      }
    }
    return { conditions, params };
  },
  /**
   * 插入数据格式化
   * 插入示例
   * { field1: 1, field2: "test2", field3: [1,2,3], field4: { data1: 1, data2: "test2" } }
   */
  insertFormatOperator: (prefix='', data={}) => {
    const fields = [];
    const params = {};
    const placeholder = [];
    for (const [key, value] of Object.entries(data)) {
      fields.push('`' + key + '`');
      placeholder.push('@' + prefix + key);
      if (typeof value === 'object') {
        params[`${prefix}${key}`] = util.serialize(value);
      }else if(typeof value === 'boolean'){
        params[`${prefix}${key}`] = value ? 1 : 0;
      }else{
        params[`${prefix}${key}`] = value
      }
    }
    return { fields, params, placeholder };
  },
  insertFormatDatas: (prefix='', datas=[]) => {
    return datas.map(data=>{
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'object') {
          data[`${prefix}${key}`] = util.serialize(value);
        }else if(typeof value === 'boolean'){
          data[`${prefix}${key}`] = value ? 1 : 0;
        }else{
          data[`${prefix}${key}`] = value
        }
      }
      return data
    })
  },
  updateFormatOperator: (data={}, filter={}) => {
    const select = util.selectFormatOperator('s_', filter);
    const prefix = 'u_';
    const params = {};
    const conditions = [];
    for (const [key, value] of Object.entries(data)) {
      conditions.push(`${key} = @${prefix}${key}`);
      if (typeof value === 'object') {
        params[`${prefix}${key}`] = util.serialize(value);
      }else if(typeof value === 'boolean'){
        params[`${prefix}${key}`] = value ? 1 : 0;
      }else{
        params[`${prefix}${key}`] = value
      }
    }
    return { update_conditions: conditions, update_params: params, select_conditions: select.conditions, select_params: select.params };
  },
  /**
   * 删除数据格式化
   * 删除示例
   * { field1: 1, field2: "test2" }
   */
  deleteFormatOperator: (data={}) => {
    return util.selectFormatOperator('', data);
  }
}

const db = {
  ...musicDB,
  close: () => musicDB.close(),
  transaction: (fn, data) => {
    const func = musicDB.transaction((data)=>{
      fn(client, data)
    })
    return func(data)
  },
  execute: (sql, params) => {
    return musicDB.prepare(sql).run(params || {})
  },
  executeBatch: (sql, datas=[]) => {
    if(datas.length === 0) return 0;
    const execute = musicDB.prepare(sql);
    const batch = musicDB.transaction((datas)=>{
      let counts = 0;
      for (const data of datas) {
        const { changes } = execute.run(data);
        counts += changes;
      }
      return counts;
    });
    return batch(datas);
  },
  prepare: (sql) => {
    return musicDB.prepare(sql);
  },
  queryOne: (sql, params) => {
    return musicDB.prepare(sql).get(params || {});
  },
  queryAll: (sql, params) => {
    return musicDB.prepare(sql).all(params || {});
  },
  iterate: (sql, params, callback=(data)=>{}) => {
    const stmt = musicDB.prepare(sql).raw()
    for (const data of stmt.iterate(params || {})) {
      callback(data)
    }
  },
}

const client = {
  db: db,
  util: util,
  transaction: (fn, data) => {
    const func = musicDB.transaction((data)=>{
      fn(client, data)
    })
    return func(data)
  },
  iterate: (table, filter={}, callback=(data)=>{}) => {
    const { conditions, params } = util.selectFormatOperator('', filter);
    const sql = conditions.length > 0 ? `SELECT * FROM ${table} WHERE ${conditions.join(' AND ')}` : `SELECT * FROM ${table}`;
    return db.iterate(sql, params, callback);
  },
  queryOne: (table, filter={}) => {
    const { conditions, params } = util.selectFormatOperator('', filter);
    const sql = conditions.length > 0 ? `SELECT * FROM ${table} WHERE ${conditions.join(' AND ')}` : `SELECT * FROM ${table}`;
    return db.queryOne(sql, params);
  },
  queryList: (table, filter={}, limit=100, offset=0) => {
    const { conditions, params } = util.selectFormatOperator('', filter);
    if(conditions.length > 0){  
      params['_limit'] = limit;
      params['_offset'] = offset;
      const sql = `SELECT * FROM ${table} WHERE ${conditions.join(' AND ')} LIMIT @_limit OFFSET @_offset`;
      return db.queryAll(sql, params);
    }else{
      params['_limit'] = limit;
      params['_offset'] = offset;
      const sql = `SELECT * FROM ${table} LIMIT @_limit OFFSET @_offset`;
      return db.queryAll(sql, params);
    }
  },
  queryAll: (table, filter={}) => {
    const { conditions, params } = util.selectFormatOperator('', filter);
    const sql = conditions.length > 0 ? `SELECT * FROM ${table} WHERE ${conditions.join(' AND ')}` : `SELECT * FROM ${table}`;
    return db.queryAll(sql, params);
  },
  page: (table, page=1, pageSize=10, sort='id ASC', filter={}) => {
    const { conditions, params } = util.selectFormatOperator('', filter);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const pagesql = db.prepare(`SELECT * FROM ${table} ${whereClause} ORDER BY ${sort} LIMIT @_limit OFFSET @_offset`);
    const countsql = db.prepare(`SELECT COUNT(*) as count FROM ${table} ${whereClause}`);
    params['_limit'] = pageSize;
    params['_offset'] = (page-1)*pageSize;
    const { count } = countsql.get(params);
    const pageData = pagesql.all(params);
    return { data: pageData, pagination: { total: count, pages: Math.ceil(count / pageSize), page, pageSize }, sort };
  },
  randomPage: (table, page=1, pageSize=10, filter={}) => {
    const { conditions, params } = util.selectFormatOperator('', filter);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const pagesql = db.prepare(`SELECT * FROM ${table} ${whereClause} ORDER BY RANDOM() LIMIT @_limit OFFSET @_offset`);
    const countsql = db.prepare(`SELECT COUNT(*) as count FROM ${table} ${whereClause}`);
    params['_limit'] = pageSize;
    params['_offset'] = (page-1)*pageSize;
    const { count } = countsql.get(params);
    const pageData = pagesql.all(params);
    return { data: pageData, pagination: { total: count, pages: Math.ceil(count / pageSize), page, pageSize } };
  },
  count: (table, filter={}) => {
    const { conditions, params } = util.selectFormatOperator('', filter);
    const sql = conditions.length > 0 ? `SELECT COUNT(*) as count FROM ${table} WHERE ${conditions.join(' AND ')}` : `SELECT COUNT(*) as count FROM ${table}`;
    return db.queryOne(sql, params).count;
  },
  insert: (table, data={}) => {
    const { fields, params, placeholder } = util.insertFormatOperator('', data);
    const sql = `INSERT INTO ${table} (${fields.join(',')}) VALUES (${placeholder.join(',')})`;
    return db.execute(sql, params);
  },
  batchInsert: (table, datas=[]) => {
    if (datas.length === 0) return 0;
    const { fields, placeholder } = util.insertFormatOperator('', datas[0]);
    const sql = `INSERT INTO ${table} (${fields.join(',')}) VALUES (${placeholder.join(',')});`;
    const formatDatas = util.insertFormatDatas('', datas);
    return db.executeBatch(sql, formatDatas);
  },
  insertOrUpdate: (table, data={}) => {
    const { fields, params, placeholder } = util.insertFormatOperator('', data);
    const { update_conditions, update_params } = util.updateFormatOperator(data, {});
    const sql = `INSERT INTO ${table} (${fields.join(',')}) VALUES (${placeholder.join(',')}) ON CONFLICT(id) DO UPDATE SET ${update_conditions.join(',')}`;
    return db.execute(sql, { ...params, ...update_params });
  },
  update: (table, data={}, filter={}) => {
    const { update_conditions, update_params, select_conditions, select_params } = util.updateFormatOperator(data, filter);
    const sql = `UPDATE ${table} SET ${update_conditions.join(',')} WHERE ${select_conditions.join(' AND ')}`;
    return db.execute(sql, { ...update_params, ...select_params });
  },
  delete: (table, filter={}) => {
    const { conditions, params } = util.deleteFormatOperator(filter);
    const sql = `DELETE FROM ${table} WHERE ${conditions.join(' AND ')}`;
    console.log(sql, params)
    return db.execute(sql, params);
  },
}

// 程序关闭时关闭数据库
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

export default client;