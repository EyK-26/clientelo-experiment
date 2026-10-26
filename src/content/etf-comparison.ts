export type Evidence={label:string;url:string;asOf:string|null;retrievedOn:string};
export type Fact<T=string>={value:T;source:string;asOf:string};
export type Fund={ticker:'SPY'|'VOO';name:Fact;benchmark:Fact;venue:Fact;cusip:Fact;expense:Fact<string>&{unit:'percent/year';basis:string}};
export type Comparison={checkedOn:string;commonFactsheetDate:string;sources:Record<string,Evidence>;funds:Fund[];broker:{buyable:boolean|null;accountVerified:boolean;policySource:string}};
export const comparison:Comparison={checkedOn:'2026-10-25',commonFactsheetDate:'2026-09-30',sources:{
 spySheet:{label:'State Street: přehled SPY',url:'https://www.ssga.com/library-content/products/factsheets/etfs/us/factsheet-us-en-spy.pdf',asOf:'2026-09-30',retrievedOn:'2026-10-25'},
 spyListing:{label:'State Street: kotace SPY',url:'https://www.ssga.com/us/en/individual/etfs/state-street-spdr-sp-500-etf-trust-spy',asOf:'2026-10-25',retrievedOn:'2026-10-25'},
 vooSheet:{label:'Vanguard: přehled VOO',url:'https://fund-docs.vanguard.com/F0968.pdf',asOf:'2026-09-30',retrievedOn:'2026-10-25'},
 lynxPolicy:{label:'LYNX: pravidla dokumentu KID',url:'https://www.lynxbroker.cz/podpora/produkty-a-regulace/regulace/key-information-document/',asOf:null,retrievedOn:'2026-10-25'},
},funds:[
 {ticker:'SPY',name:{value:'State Street SPDR S&P 500 ETF Trust',source:'spySheet',asOf:'2026-09-30'},benchmark:{value:'S&P 500',source:'spySheet',asOf:'2026-09-30'},venue:{value:'NYSE Arca',source:'spyListing',asOf:'2026-10-25'},cusip:{value:'78462F103',source:'spySheet',asOf:'2026-09-30'},expense:{value:'0.0945',unit:'percent/year',basis:'Hrubý i čistý nákladový poměr podle přehledu emitenta.',source:'spySheet',asOf:'2026-09-30'}},
 {ticker:'VOO',name:{value:'Vanguard S&P 500 ETF',source:'vooSheet',asOf:'2026-09-30'},benchmark:{value:'S&P 500',source:'vooSheet',asOf:'2026-09-30'},venue:{value:'NYSE Arca',source:'vooSheet',asOf:'2026-09-30'},cusip:{value:'922908363',source:'vooSheet',asOf:'2026-09-30'},expense:{value:'0.03',unit:'percent/year',basis:'Nákladový poměr uvedený v nejnovějším prospektu, citovaný v přehledu.',source:'vooSheet',asOf:'2026-09-30'}},
],broker:{buyable:null,accountVerified:false,policySource:'lynxPolicy'}};
// App-owned evidence rules, independent of framework persistence or HTTP admission.
export function assertComparison(input:Comparison):void {
 const isDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
 if(!isDate(input.checkedOn)||!isDate(input.commonFactsheetDate))throw new Error('invalid_evidence_date');
 for(const source of Object.values(input.sources)){
  let url:URL;try{url=new URL(source.url);}catch{throw new Error('invalid_source_url');}
  if(url.protocol!=='https:'||url.username||url.password)throw new Error('invalid_source_url');
  if(!isDate(source.retrievedOn)||source.asOf!==null&&!isDate(source.asOf))throw new Error('invalid_evidence_date');
  if(source.retrievedOn>input.checkedOn||source.asOf!==null&&source.asOf>source.retrievedOn)throw new Error('future_evidence');
 }
 for(const fund of input.funds){
  if(fund.expense.unit!=='percent/year')throw new Error('expense_unit');
  if(fund.expense.asOf!==input.commonFactsheetDate)throw new Error('unaligned_cost_dates');
  for(const fact of [fund.name,fund.benchmark,fund.venue,fund.cusip,fund.expense]){
   const source=input.sources[fact.source];if(!source)throw new Error('missing_source');
   if(!fact.value||!isDate(fact.asOf))throw new Error('invalid_fact');
   if(fact.asOf>source.retrievedOn)throw new Error('future_evidence');
   if(source.asOf!==null&&source.asOf!==fact.asOf)throw new Error('source_date_mismatch');
  }
 }
 if(!input.sources[input.broker.policySource])throw new Error('missing_source');
 // This draft has policy evidence only, no per-product/account eligibility evidence.
 if(input.broker.buyable!==null||input.broker.accountVerified)throw new Error('unverified_access_claim');
}
