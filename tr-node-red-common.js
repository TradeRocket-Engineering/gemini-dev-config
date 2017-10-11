
exports.print = function(){
	console.log("Ready To Use Dev Tool");
	return "Ready To Use Dev Tool";
}

exports.getFiltersQuery = function(searchObject,filters, exceptions, pagination, sorting){
	 var filterQuery = {};
	  if(searchObject === undefined || searchObject === null){
	      searchObject = {};
	  }
	    if(filters){
	        
	        var filterName = "";
	        var filterValue = "";
	        var ISO = '';
	        var split = '';
	        var exceptionName  = "";
	        var exceptionType  = "";
	        var exceptionList = [];
	        var strConcat = "";
	        var whereString = "";
	        var hasException = false;
	        
	        for(i=0;i<filters.length;i++){
	            
	            filterName = filters[i].name;
	            filterValue = filters[i].value;
	            hasException = false;

	            if(exceptions.length > 0){
	                
	                for(var j =0 ; j < exceptions.length;j++){
	                    
	                    exceptionName  = exceptions[j].name;
	                    exceptionType  = exceptions[j].type.toLowerCase();
	                    
	                    
	                     if(exceptionName === filterName ){
	                        hasException = true;
	                        ISO = '';
	                        split = '';
	                        
	                        
	                        if(whereString.length > 0){
	                            whereString += ' && ';
	                        } 
	                        
	                         if(exceptionType === "date"){
	                               ISO = 'ISO';
	                               split = '.split("T")[0]';
	                        }
	                        
	                        if(exceptionType == "concat"){
	                            exceptionList = exceptions[j].list;
	                            strConcat = "";
	                            for(var k =0 ; k < exceptionList.length;k++){
	                                strConcat += "this."+exceptionList[k]+" + ";
	                                
	                                if(k === exceptionList.length-1){
	                                   strConcat = strConcat.substring(0, ((strConcat.length)-2)); 
	                                }
	                            }
	                            whereString += '('+strConcat+').toString().indexOf("' + filterValue + '") >= 0';
	                        }else if(exceptionType == "number" || exceptionType === "date"){
	                            whereString += 'this.' + filterName + '.to' + ISO + 'String()' + split + '.indexOf("' + filterValue + '") >= 0';
	                        }
	                        else if(exceptionType == "equal"){
	                            
	                            if(!searchObject[filterName]){
	                                searchObject[filterName] = {};
	                            }
	                            
	                            searchObject[filterName] =  filterValue ; 
	                           
	                        }
	                        else {
	                            
	                            if(!searchObject[filterName]){
	                                searchObject[filterName] = {};
	                            }
	                            
	                            if(exceptionType == "lowerCase"){
	                                filterValue = filterValue.toLowerCase();
	                            }else  if(exceptionType == "upperCase"){
	                                filterValue = filterValue.toUpperCase();
	                            }
	                            
	                            searchObject[filterName].$regex = '.*' + filterValue + '.*'; 
	                            
	                        }
	                        break;
	                    }
	                }
	                
	                if(!hasException){
	                    if(!searchObject[filterName]){
	                        searchObject[filterName] = {};
	                    }
	                    searchObject[filterName].$regex = '.*' + filterValue + '.*';  
	                }
	                    
	            }else{
	                if(!searchObject[filterName]){
	                    searchObject[filterName] = {};
	                }
	                searchObject[filterName].$regex = '.*' + filterValue + '.*'; 
	            }
	        }
	        
	        if(whereString.length > 0){
	            searchObject.$where = whereString;
	        }
	    }

	//skip
	var skip = -1;
	var limit = -1;
	var isPaginationSet = false;
	if(pagination !== null && pagination !== undefined){
        skip = (pagination.page * pagination.pageSize) - pagination.pageSize;
	    limit = pagination.pageSize;
  	}

	//sort
	var sort = {};
	var sortSet = false; 
	if(sorting !== null && sorting !== undefined){
		if(sorting){
		    for(i=0;i<sorting.length;i++){
		        var sortOrder = 0;
		        if(sorting[i].order == 'DESC'){
		            sortOrder = -1;
		        }
		        else if(sorting[i].order == 'ASC'){
		            sortOrder = 1;
		        }
		        if(sortOrder){
		            sort[sorting[i].name] = sortOrder;
		            sortSet = true;
		        }
		    }
		}
		
	}
	
	filterQuery.isPaginationSet = isPaginationSet;
	filterQuery.limit = limit;
	filterQuery.skip = skip;
	filterQuery.sort = sort;
    filterQuery.isSortSet =sortSet;
    filterQuery.query = searchObject;
	return filterQuery;
}


