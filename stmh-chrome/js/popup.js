/**
 * @Created By zcjun.com
 * @date 2019/10/22
 * @Description:
 */
$(function(){
  $("#donate_open").click(function(){
    $("#donate").show()
  });
  $("#donate_close").click(function(){$("#donate").hide()});
  $('input[name="money"]').change(function(){var val=$(this).val();
  if(val==1){$("#donate_code").attr("src","https://old.zcjun.com/content/uploadfile/tpl_options//dszfb.jpg")}else{if(val==2){$("#donate_code").attr("src","https://old.zcjun.com/content/uploadfile/tpl_options//dswx.jpg")}}});
})
